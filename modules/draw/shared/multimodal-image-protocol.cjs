'use strict';

const { MIME_EXTENSIONS } = require('./reference-image-contract.cjs');

function upstreamReason(value) {
    return typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/i.test(value) ? value : '';
}

function endpoint(base, path) {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/+$/, '') + path;
    return url;
}

function geminiRequest(context, { payload: { model, contents, generationConfig }, referenceImages = [] }) {
    const [turn] = contents;
    return {
        url: endpoint(context.url, `/models/${encodeURIComponent(model)}:generateContent`),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': context.key },
        body: JSON.stringify({ contents: [{ ...turn, parts: [...turn.parts, ...referenceImages.map(inlineData => ({ inlineData }))] }], generationConfig }),
    };
}

function geminiResult(data) {
    const blockReason = upstreamReason(data?.promptFeedback?.blockReason);
    const values = [];
    const failures = [];
    for (const candidate of Array.isArray(data?.candidates) ? data.candidates : []) {
        const finishReason = upstreamReason(candidate?.finishReason);
        if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') failures.push(finishReason);
        for (const part of Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []) {
            if (part?.thought === true || !Object.hasOwn(part ?? {}, 'inlineData')) continue;
            values.push({ data: part.inlineData?.data, mimeType: part.inlineData?.mimeType ?? null });
        }
    }
    const blocked = (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED' ? blockReason : '')
        || failures.find(reason => /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/.test(reason));
    const reason = blocked || failures[0];
    return { values, incomplete: Boolean(reason), reason, code: blocked ? 'image_blocked' : 'no_image' };
}

function openaiRequest(context, { payload, referenceImages = [] }) {
    const headers = { Authorization: `Bearer ${context.key}` };
    const url = endpoint(context.url, `/images/${referenceImages.length ? 'edits' : 'generations'}`);
    if (!referenceImages.length) {
        headers['Content-Type'] = 'application/json';
        return { url, headers, body: JSON.stringify(payload) };
    }
    const body = new FormData();
    for (const [key, value] of Object.entries(payload)) body.set(key, String(value));
    referenceImages.forEach(({ data, mimeType }, index) => {
        const bytes = Uint8Array.from(atob(data), byte => byte.charCodeAt(0));
        body.append('image[]', new Blob([bytes], { type: mimeType }), `reference-${index + 1}.${MIME_EXTENSIONS[mimeType]}`);
    });
    return { url, headers, body };
}

const protocols = Object.freeze({
    gemini: { request: geminiRequest, result: geminiResult, errorReason: error => error?.status },
    openai: { request: openaiRequest, result(data, payload) {
        const values = Array.isArray(data?.data) ? data.data.map(image => ({ data: image?.b64_json })) : [];
        return { values, incomplete: payload.n > values.length, code: 'no_image' };
    }, errorReason: error => error?.code ?? error?.type },
});

module.exports = { protocols, upstreamReason };
