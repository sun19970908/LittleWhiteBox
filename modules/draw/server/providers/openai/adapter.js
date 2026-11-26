'use strict';

const { normalizeImageApi, postImageApi, decodeImageResult } = require('../image-api.js');
const { protocols: { openai } } = require('../../../shared/multimodal-image-protocol.cjs');

const SETTINGS = Object.freeze({
    size: value => typeof value === 'string' && /^(?:auto|[1-9]\d*x[1-9]\d*)$/.test(value),
    quality: value => ['auto', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value),
    background: value => ['auto', 'opaque', 'transparent'].includes(value),
    output_format: value => ['png', 'jpeg', 'webp'].includes(value),
    n: value => Number.isInteger(value) && value >= 1 && value <= 10,
});

function normalizePayload(payload) {
    const model = typeof payload.model === 'string' && payload.model.trim();
    if (!model) throw new Error('payload.model is required');
    if (typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 32000) {
        throw new Error('payload.prompt must contain between 1 and 32000 characters');
    }
    const normalized = { model, prompt: payload.prompt };
    for (const [key, value] of Object.entries(payload)) {
        if (key === 'model' || key === 'prompt') continue;
        if (!Object.hasOwn(SETTINGS, key) || !SETTINGS[key](value)) throw new Error(`payload.${key} is not supported or is invalid`);
        normalized[key] = value;
    }
    if (normalized.background === 'transparent' && normalized.output_format === 'jpeg') {
        throw new Error('payload.background cannot be transparent when output_format is jpeg');
    }
    return normalized;
}

function normalize(context, items, helpers) {
    return normalizeImageApi(context, items, helpers, normalizePayload);
}

async function execute({ context, item, signal }) {
    const { url, ...request } = openai.request(context, item.request);
    const data = await postImageApi(url, { ...request, signal, providerName: 'OpenAI GPT Image', errorReason: openai.errorReason });
    const { values, incomplete } = openai.result(data, item.request.payload);
    return decodeImageResult(values, { providerName: 'OpenAI GPT Image', resultMode: item.request.resultMode, incomplete, signal });
}

module.exports = { execute, normalize };
