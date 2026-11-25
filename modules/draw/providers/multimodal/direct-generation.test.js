import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { createDrawPublicApi } from '../../shared/public-api.js';
import { prepareImageInput } from '../../shared/prepared-image-input.js';
import { compileDrawRunImages } from '../../node-entry.js';
import { IMAGE_COLLECTION_MIME, packImageCollection } from '../../shared/image-collection.js';
import { createGenerationRecipe } from './compiler.js';
import { adaptUnplannedTask, createDirectGeneration } from './direct-generation.js';
import { createDefaultSettings } from './settings-model.js';
import service from '../../server/image-jobs/service.js';
import gemini from '../../server/providers/gemini/adapter.js';
import openai from '../../server/providers/openai/adapter.js';

const image = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0);
const refs = [{ mimeType: 'image/png', data: Buffer.from(image).toString('base64') }];
const description = 'A fully clothed traveler gazes out over a moonlit river.';
const makeSettings = provider => ({ ...createDefaultSettings(provider), apiKey: 'test-key', apiBaseUrl: 'https://image.example.test/v1' });
const wireText = (provider, item) => provider === 'gemini' ? item.payload.contents[0].parts[0].text : item.payload.prompt;

for (const provider of ['gemini', 'openai']) {
    for (const referenceImages of [undefined, refs]) {
        test(`${provider}: ${referenceImages ? 'edit' : 'generate'} passes the real image-job validator`, async () => {
            const adapter = createDirectGeneration(provider, {
                plan: async (_id, input) => ({ ...input, prompt: description }),
                jobs: { async runJob(job, handlers) {
                    const normalized = service.normalizeImageJobRequest({ ...job, requestId: 'direct-job' }, { gemini, openai });
                    const [image] = normalized.items;
                    assert.equal(image.request.resultMode, 'all');
                    assert.deepEqual(image.request.referenceImages, referenceImages);
                    await handlers.onItemReady({ response: new Response(imageBytes, { headers: { 'Content-Type': 'image/png' } }) });
                } },
            });
            const imageBytes = image;
            assert.equal((await adapter.generate({ prompt: 'draw a river', referenceImages }, makeSettings(provider))).length, 1);
        });
    }
    test(`${provider}: public edit adapts all guidance before sending and collects charged partial results`, async () => {
        const settings = makeSettings(provider);
        const stages = [];
        let collected;
        const adapter = createDirectGeneration(provider, { snapshot: () => settings,
            async plan(id, input, config) {
                stages.push('plan');
                assert.equal(id, provider);
                assert.equal(config.apiKey, settings.apiKey);
                assert.equal(input.prompt, 'original request');
                assert.equal(input.positivePrefix, 'art direction');
                assert.equal(input.negativePrompt, 'explicit exclusions');
                assert.deepEqual(input.characterPrompts, [{ name: 'Dawn', prompt: 'silver coat', uc: 'red trim' }]);
                return { ...input, prompt: description };
            },
            jobs: { async runJob(job, handlers) {
                stages.push('submit');
                assert.equal(job.provider, provider);
                assert.deepEqual(job.context, { url: settings.apiBaseUrl, key: settings.apiKey });
                assert.equal(job.items.length, 1);
                assert.equal(handlers.retryCreate, false);
                const { request } = job.items[0];
                assert.equal(wireText(provider, request), description);
                assert.equal(request.resultMode, 'all');
                assert.deepEqual(request.referenceImages, refs);
                assert.equal(provider === 'gemini' ? request.payload.generationConfig.imageConfig.aspectRatio : request.payload.size,
                    provider === 'gemini' ? '4:3' : '1536x1024');
                await handlers.onItemReady({ response: new Response(packImageCollection([image], true), { headers: { 'Content-Type': IMAGE_COLLECTION_MIME } }) });
            } },
        });
        const draw = createDrawPublicApi({ isEnabled: () => true, getProvider: () => provider, providers: { [provider]: adapter },
            captureGallery: () => async (images, metadata) => { stages.push('collect'); collected = { images, metadata }; },
        });
        await assert.rejects(draw.generate({ prompt: 'original request', positivePrefix: 'art direction', negativePrompt: 'explicit exclusions',
            characterPrompts: [{ name: 'Dawn', prompt: 'silver coat', uc: 'red trim' }], referenceImages: refs,
            overrideSize: provider === 'gemini' ? '4:3' : '1536x1024',
        }), { code: 'partial_result' });
        assert.deepEqual(stages, ['plan', 'submit', 'collect']);
        assert.equal(collected.images[0].type, 'image/png');
        assert.equal(collected.metadata.presetId, settings.selectedParamsPresetId);
    });

    test(`${provider}: registered compilers preserve native and redraw placement and consume only adapted text`, async () => {
        const settings = makeSettings(provider);
        const placements = [{ mode: 'replace', marker: '[img]original[/img]', start: 11, end: 30 }, { mode: 'existing', slotId: 'original-slot' }];
        const prompts = [];
        const tasks = await Promise.all(placements.map(placement => adaptUnplannedTask(provider, { scene: 'raw', placement,
            characterPrompts: [{ name: 'Dawn', prompt: 'silver coat', uc: 'red trim', center: { x: 0.5, y: 0.5 } }],
            post_prompt: 'saved detail', negativePrompt: 'saved exclusions', title: 'River',
        }, settings, { async plan(_provider, input) { prompts.push(input); return { prompt: description }; } })));
        assert.equal(prompts.length, placements.length);
        for (const input of prompts) {
            assert.equal(input.prompt, 'raw\nsaved detail');
            assert.equal(input.negativePrompt, 'saved exclusions');
            assert.deepEqual(input.characterPrompts, [{ name: 'Dawn', prompt: 'silver coat', uc: 'red trim' }]);
        }
        placements.forEach((placement, index) => assert.equal(tasks[index].placement, placement));
        const recipe = createGenerationRecipe(provider, settings);
        const prepared = prepareImageInput(provider, tasks, recipe);
        assert.deepEqual(prepared.metadata.map(entry => entry.tags), [description, description]);
        assert.deepEqual(prepared.metadata.map(entry => entry.title), ['River', 'River']);
        assert.deepEqual(compileDrawRunImages(provider, tasks, recipe).items, prepared.compiledBatch.items);
        assert.deepEqual(prepared.compiledBatch.items.map(({ request }) => wireText(provider, request)), [description, description]);
    });
}

test('a cancelled adaptation cannot send an image job even if the planner produced text', async () => {
    const provider = 'openai';
    const controller = new AbortController();
    let submitted = false;
    const adapter = createDirectGeneration(provider, { jobs: { async runJob() { submitted = true; } },
        async plan(_provider, input) { controller.abort(); return { ...input, prompt: description }; },
    });
    await assert.rejects(adapter.generate({ prompt: 'raw' }, makeSettings(provider), { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(submitted, false);
});
