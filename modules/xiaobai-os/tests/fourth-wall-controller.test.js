import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createDefaultFourthWallChatState,
    createDefaultFourthWallGlobalSettings,
} from '../apps/fourth-wall/domain/defaults.js';
import { createFourthWallController } from '../apps/fourth-wall/host/controller.js';
import { createFourthWallGenerationRuntime } from '../apps/fourth-wall/host/generation-runtime.js';

function flushAsyncWork() {
    return new Promise(resolve => globalThis.setTimeout(resolve, 0));
}

function createHarness({ secondSession = false, prepareChat = null } = {}) {
    const state = {
        chatIdentity: 'chat:a',
        chat: createDefaultFourthWallChatState(1000),
        mutationAttempts: 0,
        failMutationAt: 0,
        unconfirmedMutationAt: 0,
        beforeMutationCommit: null,
    };
    if (secondSession) {
        state.chat.sessions.push({
            id: 'second',
            name: 'Second',
            createdAt: 1001,
            history: [],
        });
    }
    const mutations = [];
    const posts = [];
    const requests = [];
    const globalSettings = createDefaultFourthWallGlobalSettings();
    let timestamp = 2000;

    const controller = createFourthWallController({
        chatRepository: {
            prepareCurrentChatFourthWall: async () => prepareChat
                ? await prepareChat(state)
                : structuredClone(state.chat),
            readCurrentChatFourthWall: () => structuredClone(state.chat),
            async mutateCurrentChatFourthWall(mutator, options = {}) {
                state.mutationAttempts += 1;
                const next = mutator(structuredClone(state.chat));
                await state.beforeMutationCommit?.();
                await options.beforeCommit?.();
                if (state.mutationAttempts === state.failMutationAt) {
                    throw new Error('save failed');
                }
                state.chat = structuredClone(next);
                mutations.push(structuredClone(next));
                if (state.mutationAttempts === state.unconfirmedMutationAt) {
                    throw Object.assign(new Error('save result unconfirmed'), {
                        code: 'SAVE_UNCONFIRMED',
                        uncertain: true,
                    });
                }
                return structuredClone(next);
            },
        },
        settingsRepository: {
            read: () => ({ apps: { fourthWall: structuredClone(globalSettings) } }),
            async mutateFourthWall(mutator) {
                return mutator(structuredClone(globalSettings));
            },
        },
        getChatIdentity: () => ({ key: state.chatIdentity }),
        getChatSnapshot: () => ({
            chatIdentity: state.chatIdentity,
            userName: 'User',
            characterName: 'Character',
            messages: [],
        }),
        generateResponse(options) {
            return new Promise((resolve, reject) => {
                requests.push({ ...options, resolve, reject });
            });
        },
        loadAgentConfig: async () => ({ provider: 'test' }),
        now: () => ++timestamp,
    });

    return { controller, mutations, posts, requests, state };
}

async function activateAndSend(harness) {
    await harness.controller.activate({
        post: (type, payload) => harness.posts.push({ type, payload }),
    });
    await harness.controller.handleMessage({
        type: 'fourth-wall/send',
        requestId: 'request-1',
        payload: {
            chatIdentity: 'chat:a',
            sessionId: 'default',
            content: 'hello',
        },
    });
    await flushAsyncWork();
    assert.equal(harness.requests.length, 1);
    return harness.requests[0];
}

test('streaming is temporary and a final response is persisted exactly once', async () => {
    const harness = createHarness();
    const request = await activateAndSend(harness);

    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['hello']);
    request.onStreamProgress({ text: '<thinking>draft</thinking><msg>partial</msg>' });
    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['hello']);
    assert.equal(harness.posts.at(-1).payload.text, 'partial');

    request.resolve({ text: '<thinking>done</thinking><msg>final answer</msg>' });
    await flushAsyncWork();

    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), [
        'hello',
        'final answer',
    ]);
    assert.equal(harness.mutations.length, 2);
    assert.equal(harness.posts.filter(item => item.payload.status === 'complete').length, 1);
});

test('a final save failure leaves the generated reply observable but unpersisted', async () => {
    const harness = createHarness();
    harness.state.failMutationAt = 2;
    const request = await activateAndSend(harness);

    request.resolve({ text: '<msg>unsaved answer</msg>' });
    await flushAsyncWork();

    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['hello']);
    const failure = harness.posts.find(item => item.payload.kind === 'save');
    assert.equal(failure.payload.status, 'error');
    assert.equal(failure.payload.draft.text, 'unsaved answer');
    assert.match(failure.payload.message, /未保存/);
});

test('an unconfirmed final save keeps and republishes the candidate without duplicating the draft', async () => {
    const harness = createHarness();
    harness.state.unconfirmedMutationAt = 2;
    const request = await activateAndSend(harness);

    request.resolve({ text: '<msg>possibly saved answer</msg>' });
    await flushAsyncWork();

    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), [
        'hello',
        'possibly saved answer',
    ]);
    const retainedState = harness.posts.findLast(item => item.type === 'fourth-wall/state');
    assert.equal(retainedState.payload.state.chat.sessions[0].history.at(-1).content, 'possibly saved answer');
    const failure = harness.posts.find(item => item.payload.kind === 'save');
    assert.equal(failure.payload.draft, undefined);
    assert.match(failure.payload.message, /保存结果未确认/);
});

test('cancelled generation ignores late progress and final results', async () => {
    const harness = createHarness();
    const request = await activateAndSend(harness);

    const result = await harness.controller.handleMessage({
        type: 'fourth-wall/cancel',
        payload: { chatIdentity: 'chat:a', sessionId: 'default' },
    });
    const postsAfterCancel = harness.posts.length;
    request.onStreamProgress({ text: '<msg>late progress</msg>' });
    request.resolve({ text: '<msg>late final</msg>' });
    await flushAsyncWork();

    assert.deepEqual(result, { cancelled: true });
    assert.equal(harness.posts.length, postsAfterCancel);
    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['hello']);
});

test('closing while a completed generation waits to commit prevents the AI result from being saved', async () => {
    const harness = createHarness();
    const request = await activateAndSend(harness);
    let releaseCommit;
    let markCommitStarted;
    const commitStarted = new Promise(resolve => { markCommitStarted = resolve; });
    const commitGate = new Promise(resolve => { releaseCommit = resolve; });
    harness.state.beforeMutationCommit = async () => {
        markCommitStarted();
        await commitGate;
    };

    request.resolve({ text: '<msg>stale final</msg>' });
    await commitStarted;
    harness.controller.deactivate('closed');
    releaseCommit();
    await flushAsyncWork();
    await flushAsyncWork();

    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['hello']);
    assert.equal(harness.posts.some(item => item.payload.status === 'complete'), false);
});

test('chat switch, session switch, and deactivation invalidate old results', async (context) => {
    const cases = [
        {
            name: 'chat switch',
            setup: () => createHarness(),
            invalidate: async (harness) => { harness.state.chatIdentity = 'chat:b'; },
        },
        {
            name: 'session switch',
            setup: () => createHarness({ secondSession: true }),
            invalidate: async (harness) => {
                await harness.controller.handleMessage({
                    type: 'fourth-wall/switch-session',
                    payload: {
                        chatIdentity: 'chat:a',
                        sessionId: 'default',
                        targetSessionId: 'second',
                    },
                });
            },
        },
        {
            name: 'deactivation',
            setup: () => createHarness(),
            invalidate: async (harness) => { harness.controller.deactivate('closed'); },
        },
    ];

    for (const item of cases) {
        await context.test(item.name, async () => {
            const harness = item.setup();
            const request = await activateAndSend(harness);
            await item.invalidate(harness);
            const mutationCount = harness.mutations.length;

            request.onStreamProgress({ text: '<msg>late progress</msg>' });
            request.resolve({ text: '<msg>late final</msg>' });
            await flushAsyncWork();

            assert.equal(harness.mutations.length, mutationCount);
            assert.equal(
                harness.state.chat.sessions.some(session => session.history.some(message => message.role === 'ai')),
                false,
            );
        });
    }
});

test('closing the foreground invalidates an activation that is still preparing chat data', async () => {
    let finishPreparation;
    const harness = createHarness({
        prepareChat: state => new Promise(resolve => {
            finishPreparation = () => resolve(structuredClone(state.chat));
        }),
    });
    const pending = harness.controller.activate();

    await Promise.resolve();
    harness.controller.cancelForeground('closed');
    finishPreparation();

    await assert.rejects(pending, /聊天已切换/);
    await assert.rejects(
        harness.controller.handleMessage({
            type: 'fourth-wall/refresh',
            payload: { chatIdentity: 'chat:a' },
        }),
        /未激活/,
    );
});

test('a request from an old activation cannot continue in a reopened view of the same chat', async () => {
    const harness = createHarness();
    await harness.controller.activate({
        post: (type, payload) => harness.posts.push({ type, payload }),
    });
    let releaseMutation;
    let markMutationStarted;
    const mutationStarted = new Promise(resolve => { markMutationStarted = resolve; });
    const mutationGate = new Promise(resolve => { releaseMutation = resolve; });
    harness.state.beforeMutationCommit = async () => {
        markMutationStarted();
        await mutationGate;
    };

    const staleSend = harness.controller.handleMessage({
        type: 'fourth-wall/send',
        requestId: 'stale-send',
        payload: {
            chatIdentity: 'chat:a',
            sessionId: 'default',
            content: 'already being saved',
        },
    });
    await mutationStarted;
    harness.controller.deactivate('closed');
    const reopenedPosts = [];
    await harness.controller.activate({
        post: (type, payload) => reopenedPosts.push({ type, payload }),
    });

    releaseMutation();
    await assert.rejects(staleSend, /页面已切换/);
    await flushAsyncWork();

    assert.equal(harness.requests.length, 0);
    assert.deepEqual(reopenedPosts, []);
    assert.deepEqual(harness.state.chat.sessions[0].history.map(message => message.content), ['already being saved']);
});

test('an abort-shaped provider failure settles the generation instead of leaving it running', async () => {
    const cancelled = [];
    const runtime = createFourthWallGenerationRuntime({
        loadAgentConfig: async () => ({}),
        generateResponse: async () => {
            const error = new Error('provider aborted');
            error.name = 'AbortError';
            throw error;
        },
    });

    const run = runtime.start({
        requestId: 'request-abort',
        builtPrompt: { msg1: '', msg2: '', msg3: '', msg4: '' },
        stream: false,
        disableAssistantPrefill: false,
        onCancelled: reason => cancelled.push(reason),
    });

    assert.deepEqual(await run.done, { status: 'cancelled' });
    assert.equal(runtime.isRunning(), false);
    assert.deepEqual(cancelled, ['aborted']);
});

test('Fourth Wall no longer owns an Agent settings action', async () => {
    const harness = createHarness();
    await harness.controller.activate({
        post: (type, payload) => harness.posts.push({ type, payload }),
    });

    await assert.rejects(harness.controller.handleMessage({
        type: 'fourth-wall/open-agent-settings',
        payload: { chatIdentity: 'chat:a', sessionId: 'default' },
    }), /unsupported_fourth_wall_action/);
});

test('a real commentary event prepares a new chat before generating and saving', async () => {
    let chat = null;
    let commentaryHandler;
    let prepareCalls = 0;
    const shown = [];
    const globalSettings = createDefaultFourthWallGlobalSettings();
    globalSettings.commentary = { enabled: true, probability: 99 };
    const controller = createFourthWallController({
        chatRepository: {
            async prepareCurrentChatFourthWall() {
                prepareCalls += 1;
                chat = createDefaultFourthWallChatState(1000);
                return structuredClone(chat);
            },
            readCurrentChatFourthWall: () => chat ? structuredClone(chat) : null,
            async mutateCurrentChatFourthWall(mutator) {
                chat = mutator(structuredClone(chat));
                return structuredClone(chat);
            },
        },
        settingsRepository: {
            read: () => ({ apps: { fourthWall: structuredClone(globalSettings) } }),
            mutateFourthWall: async mutator => mutator(structuredClone(globalSettings)),
        },
        getChatIdentity: () => ({ key: 'chat:new' }),
        getChatSnapshot: () => ({
            chatIdentity: 'chat:new',
            userName: 'User',
            characterName: 'Character',
            userAvatar: '',
            characterAvatar: '',
            messages: [],
        }),
        generateResponse: async () => ({ text: '<msg>new chat aside</msg>' }),
        loadAgentConfig: async () => ({}),
        commentary: {
            subscribe(handler) {
                commentaryHandler = handler;
                return () => {};
            },
            capture: () => ({
                chatIdentity: 'chat:new',
                messageIndex: 0,
                text: 'new message',
                kind: 'ai_message',
                chatSnapshot: {
                    chatIdentity: 'chat:new',
                    userName: 'User',
                    characterName: 'Character',
                    userAvatar: '',
                    characterAvatar: '',
                    messages: [],
                },
            }),
            show: text => shown.push(text),
            random: () => 0,
            now: () => 200000,
            setTimer(callback) {
                queueMicrotask(callback);
                return 1;
            },
            clearTimer: () => {},
        },
    });

    controller.startBackground();
    assert.equal(await commentaryHandler({ kind: 'ai_message' }), true);

    assert.equal(prepareCalls, 1);
    assert.equal(chat.sessions[0].history.at(-1).content, '(glanced at the last line) new chat aside');
    assert.deepEqual(shown, ['new chat aside']);
    controller.stopBackground();
});
