'use strict';

const { endpoint } = require('../upstream.js');
const {
    isObject, normalizeImageApi, upstreamReason, postImageApi, imageResultError, decodeImageResult,
} = require('../image-api.js');

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function normalizePayload(payload) {
    const model = typeof payload.model === 'string' && payload.model.trim();
    if (!model || !MODEL_ID.test(model)) throw new Error('payload.model must be a Gemini model ID');
    if (!Array.isArray(payload.contents) || payload.contents.length !== 1) throw new Error('payload.contents must contain one user turn');
    const [content] = payload.contents;
    if (!isObject(content) || (content.role !== undefined && content.role !== 'user') || !Array.isArray(content.parts)) {
        throw new Error('payload.contents must contain a user turn with parts');
    }
    if (!content.parts.length) throw new Error('payload.contents must contain a non-empty text prompt');
    const parts = Array.from(content.parts, (part) => {
        if (!isObject(part) || Object.keys(part).length !== 1 || typeof part.text !== 'string' || !part.text.trim()) {
            throw new Error('payload.contents parts must contain only non-empty text; submit referenceImages separately');
        }
        return { text: part.text };
    });
    const generationConfig = payload.generationConfig;
    if (!isObject(generationConfig) || !Array.isArray(generationConfig.responseModalities)
        || !generationConfig.responseModalities.includes('IMAGE')
        || generationConfig.responseModalities.some(value => value !== 'TEXT' && value !== 'IMAGE')) {
        throw new Error('payload.generationConfig.responseModalities must request IMAGE with optional TEXT');
    }
    const { aspectRatio, imageSize } = generationConfig.imageConfig ?? {};
    if (typeof aspectRatio !== 'string' || !/^\d+:\d+$/.test(aspectRatio) || typeof imageSize !== 'string' || !imageSize.trim()) {
        throw new Error('payload.generationConfig.imageConfig must specify aspectRatio and imageSize');
    }
    return { model, contents: [{ role: 'user', parts }], generationConfig: {
        responseModalities: [...generationConfig.responseModalities], imageConfig: { aspectRatio, imageSize },
    } };
}

function normalize(context, items, helpers) {
    return normalizeImageApi(context, items, helpers, normalizePayload);
}

async function execute({ context, item, signal }) {
    const { payload: { model, contents, generationConfig }, referenceImages = [], resultMode } = item.request;
    const [turn] = contents;
    const url = endpoint(context.url, `/models/${encodeURIComponent(model)}:generateContent`, { appendPath: true });
    const data = await postImageApi(url, {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': context.key },
        body: JSON.stringify({ contents: [{ ...turn, parts: [...turn.parts, ...referenceImages.map(inlineData => ({ inlineData }))] }], generationConfig }),
        signal,
        providerName: 'Gemini',
        errorReason: error => error?.status,
    });
    const blockReason = upstreamReason(data?.promptFeedback?.blockReason);
    const promptBlocked = blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED';
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const values = [];
    const failures = [];
    for (const candidate of candidates) {
        const finishReason = upstreamReason(candidate?.finishReason);
        if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') failures.push(finishReason);
        for (const part of Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []) {
            if (part?.thought === true || !Object.hasOwn(part ?? {}, 'inlineData')) continue;
            values.push({ data: part.inlineData?.data, mimeType: part.inlineData?.mimeType ?? null });
        }
    }
    const blocked = promptBlocked ? blockReason : failures.find(reason => /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/.test(reason));
    const reason = blocked || failures[0];
    return decodeImageResult(values, {
        providerName: 'Gemini', resultMode, signal, incomplete: Boolean(reason),
        missingError: reason ? imageResultError(`Gemini did not return an image (${reason})`, blocked ? 'image_blocked' : 'no_image') : undefined,
    });
}

module.exports = { execute, normalize };
