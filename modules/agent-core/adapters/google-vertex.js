import { GoogleAdapter } from './google.js';
import { createVertexAuth } from './vertex-auth.js';
import { resolveVertexEndpoint, VERTEX_PROVIDER, VERTEX_COPY } from '../vertex-config.js';
import { extractModelListIds } from '../../../shared/common/model-list.js';
import { createVertexStreamAccumulator } from './vertex-stream.js';
import { buildVertexBody, createVertexClient } from './vertex-transport.js';

function createConnection(config) {
    const endpoint = resolveVertexEndpoint(config);
    const getHeaders = createVertexAuth(endpoint, config.apiKey, { timeoutMs: Math.min(Number(config.timeoutMs) || 30_000, 30_000) });
    const apiKey = endpoint.account ? '' : String(config.apiKey).trim();
    const headers = endpoint.account ? {} : { 'x-goog-api-key': apiKey };
    const url = `${endpoint.baseUrl}${endpoint.apiVersion ? `/${endpoint.apiVersion}` : ''}/${endpoint.model}:generateContent`;
    return {
        provider: VERTEX_PROVIDER,
        model: endpoint.model,
        url,
        auth: { headers: endpoint.account ? { Authorization: '[redacted]' } : headers },
        prepareRequest: async signal => ({ httpOptions: { headers: { ...headers, ...await getHeaders(signal) } } }),
        client: createVertexClient({ url, timeoutMs: Number(config.timeoutMs) || 15 * 60 * 1000 }),
        getHeaders, endpoint,
    };
}

export class GoogleVertexAdapter extends GoogleAdapter {
    constructor(config) { super(config, createConnection(config)); }

    createStreamAccumulator(prefix) { return createVertexStreamAccumulator(prefix); }

    inspectRequest(task, options = {}) {
        const result = super.inspectRequest(task, options);
        return this.inspectWireRequest(result, task);
    }

    inspectSendRequest(message, task, reasoning) {
        return this.inspectWireRequest(super.inspectSendRequest(message, task, reasoning), task);
    }

    inspectWireRequest(result, task) {
        const source = result.request.body;
        const session = source.chatCreate || source.session;
        result.transport = 'vertex-generate-content';
        result.request.body = buildVertexBody(session.history, source.sendMessage.message, session.config);
        delete result.request.sdk;
        if (typeof task.onStreamProgress === 'function') result.request.url = result.request.url.replace(/:generateContent$/, ':streamGenerateContent?alt=sse');
        return result;
    }

    buildChatPayload(task, reasoning) {
        const payload = super.buildChatPayload(task, reasoning);
        // 3.8 / 4 Argon reject penalties and ignore legacy sampling. Channel selection,
        // not an opaque relay model name, owns this contract.
        const config = payload.createPayload.config;
        delete config.temperature;
        this.configureToolStream(config, task);
        return payload;
    }

    configureToolStream(config, task) {
        const functionConfig = config.toolConfig?.functionCallingConfig;
        if (!functionConfig) return;
        if (typeof task.onStreamProgress === 'function' && functionConfig.mode !== 'NONE'
            && this.config.vertex?.streamFunctionCallArguments !== false) functionConfig.streamFunctionCallArguments = true;
        else delete functionConfig.streamFunctionCallArguments;
    }

    async chat(task) {
        // A session may switch streaming on/off between tool rounds.
        if (this.sessionConfig) this.configureToolStream(this.sessionConfig, task);
        return super.chat(task);
    }
}

export async function pullVertexModels(config, { signal } = {}) {
    const endpoint = resolveVertexEndpoint(config, { modelRequired: false });
    const getHeaders = createVertexAuth(endpoint, config.apiKey);
    const models = [];
    let pageToken = '';
    do {
        const relay = endpoint.vertex.authMode === 'relay';
        const url = new URL(relay ? `${endpoint.baseUrl}/models` : '/v1/publishers/google/models', endpoint.baseUrl);
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { headers: await getHeaders(signal), signal });
        if (!response.ok) throw Object.assign(new Error(`${VERTEX_COPY.modelsFailed}（HTTP ${response.status}）`), { status: response.status });
        const data = await response.json();
        if (relay) models.push(...extractModelListIds(data));
        for (const item of data.publisherModels || []) {
            const id = String(item.name || '').split('/').at(-1);
            if (/^gemini-/.test(id) && !/image|embedding|tts|live|audio/i.test(id)) models.push(id);
        }
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    if (!models.length) throw new Error(VERTEX_COPY.noModels);
    return [...new Set(models)];
}
