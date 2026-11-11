import { resolveApiBaseUrl } from '../../shared/common/openai-url-utils.js';
import vertexContract from './vertex-contract.cjs';

// Vertex owns its credentials and endpoint; it never reads the host's main API.
export const VERTEX_PROVIDER = 'google-vertex';
export const VERTEX_LABEL = 'Google Vertex AI';
export const VERTEX_DEFAULTS = vertexContract.defaults;
export const VERTEX_AUTH_MODES = vertexContract.authModes;
export const VERTEX_COPY = Object.freeze({
    auth: '连接方式', project: '项目 ID', projectPlaceholder: '留空使用 JSON 中的项目',
    location: '区域', account: '服务账号 JSON', chooseFile: '选择 JSON 文件',
    invalidAccount: '请提供有效的 Google 服务账号 JSON（包含 project_id、client_email 和 private_key）。',
    invalidLocation: 'Vertex 区域格式无效。', invalidProject: 'Vertex 项目 ID 格式无效。',
    invalidModel: '请填写模型名称。',
    missingRelayUrl: '请填写中转地址。', invalidRelayUrl: '中转地址必须是 HTTP 或 HTTPS 地址，不能包含账号、查询参数或片段。',
    missingRelayKey: '请填写中转 API Key。',
    streamArguments: '流式工具参数', streamOn: '开启', streamOff: '关闭',
    missingKey: '请填写 Vertex Express API Key。',
    invalidMode: 'Vertex 认证方式无效。',
    secureContext: '服务账号认证需要 HTTPS 或 localhost，以及支持 Web Crypto 的浏览器。',
    invalidPrivateKey: '服务账号私钥无效，请重新导入 Google 下载的 JSON 文件。',
    tokenFailed: 'Vertex 身份验证失败', invalidToken: 'Google 未返回有效的访问令牌。',
    tokenTimeout: 'Vertex 身份验证超时，请检查网络后重试。',
    modelsFailed: 'Vertex 模型列表拉取失败', noModels: 'Vertex 未返回可用的 Gemini 文本模型。',
});

export function normalizeVertexConfig(value = {}) {
    return {
        authMode: String(value?.authMode ?? VERTEX_DEFAULTS.authMode),
        projectId: String(value?.projectId ?? '').trim(),
        location: String(value?.location ?? VERTEX_DEFAULTS.location).trim(),
        serviceAccountJson: String(value?.serviceAccountJson ?? '').trim(),
        streamFunctionCallArguments: value?.streamFunctionCallArguments !== false,
    };
}

export function vertexConfigFields(provider, value) {
    return provider === VERTEX_PROVIDER ? { vertex: normalizeVertexConfig(value) } : {};
}

// Saved mode-switch drafts stay local; runtime consumers receive only active credentials.
export function vertexRuntimeFields(provider, config) {
    if (provider !== VERTEX_PROVIDER) return {};
    const vertex = normalizeVertexConfig(config.vertex);
    const standard = vertex.authMode === 'service-account';
    return { baseUrl: vertex.authMode === 'relay' ? String(config.baseUrl || '').trim() : '', apiKey: standard ? '' : String(config.apiKey || '').trim(),
        vertex: standard ? vertex : { ...vertex, serviceAccountJson: '', projectId: '' } };
}

export function vertexSecrets(value) {
    if (typeof value !== 'string' || !value) return [];
    try {
        const account = JSON.parse(value);
        return [value, ...(typeof account?.private_key === 'string' && account.private_key ? [account.private_key] : [])];
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return [value];
    }
}

export function parseVertexServiceAccount(value) {
    let account;
    try { account = JSON.parse(value); } catch { throw new Error(VERTEX_COPY.invalidAccount); }
    if (account?.type !== 'service_account' || typeof account.client_email !== 'string'
        || !account.client_email.endsWith('.gserviceaccount.com') || typeof account.private_key !== 'string'
        || !account.private_key.startsWith('-----BEGIN PRIVATE KEY-----') || typeof account.project_id !== 'string') {
        throw new Error(VERTEX_COPY.invalidAccount);
    }
    return account;
}

export function resolveVertexEndpoint(config, { modelRequired = true } = {}) {
    const vertex = normalizeVertexConfig(config.vertex);
    if (!VERTEX_AUTH_MODES.some(mode => mode.value === vertex.authMode)) throw new Error(VERTEX_COPY.invalidMode);
    const model = String(config.model || '').trim();
    if (modelRequired && !model) throw new Error(VERTEX_COPY.invalidModel);
    // Model IDs are opaque relay routes, not capability selectors or URL paths.
    const modelPath = encodeURIComponent(model).replace(/\.\./g, '%2E%2E');
    if (vertex.authMode === 'relay') {
        if (!String(config.apiKey || '').trim()) throw new Error(VERTEX_COPY.missingRelayKey);
        const baseUrl = config.resolvedBaseUrl || resolveApiBaseUrl(config.baseUrl, '/v1beta');
        if (!baseUrl) throw new Error(VERTEX_COPY.missingRelayUrl);
        let url;
        try { url = new URL(baseUrl); } catch { throw new Error(VERTEX_COPY.invalidRelayUrl); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(VERTEX_COPY.invalidRelayUrl);
        return { vertex, baseUrl: baseUrl.replace(/\/+$/, ''), apiVersion: '', model: `models/${modelPath}` };
    }
    if (vertex.authMode === 'api-key') {
        if (!String(config.apiKey || '').trim()) throw new Error(VERTEX_COPY.missingKey);
        return { vertex, baseUrl: 'https://aiplatform.googleapis.com', apiVersion: 'v1', model: `publishers/google/models/${modelPath}` };
    }
    const account = parseVertexServiceAccount(vertex.serviceAccountJson);
    const projectId = vertex.projectId || account.project_id;
    if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) throw new Error(VERTEX_COPY.invalidProject);
    if (!/^(?:global|us|eu|[a-z]+(?:-[a-z]+)+\d+)$/.test(vertex.location)) throw new Error(VERTEX_COPY.invalidLocation);
    const baseUrl = vertex.location === 'global' ? 'https://aiplatform.googleapis.com'
        : ['us', 'eu'].includes(vertex.location) ? `https://aiplatform.${vertex.location}.rep.googleapis.com`
            : `https://${vertex.location}-aiplatform.googleapis.com`;
    return { vertex, account, baseUrl, apiVersion: 'v1', model: `projects/${projectId}/locations/${vertex.location}/publishers/google/models/${modelPath}` };
}
