import { VERTEX_COPY } from '../vertex-config.js';
import { runWithAbortDeadline } from '../../../shared/common/abort-utils.js';

// Google service-account OAuth contract; JSON token_uri is deliberately not a destination.
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encodeJson = value => base64url(encoder.encode(JSON.stringify(value)));

export function createVertexAuth(endpoint, apiKey, { timeoutMs = 30_000 } = {}) {
    if (!endpoint.account) return async signal => {
        signal?.throwIfAborted();
        return { 'x-goog-api-key': String(apiKey).trim() };
    };
    // Only this adapter owns the key and token. No disk cache, global credential or refresh timer.
    let signingKey;
    let token;
    let expiresAt = 0;
    async function authorize(signal) {
        signal?.throwIfAborted();
        if (token && Date.now() < expiresAt - 60_000) return { Authorization: `Bearer ${token}` };
        if (!globalThis.crypto?.subtle) throw new Error(VERTEX_COPY.secureContext);
        if (!signingKey) {
            try {
                const pem = endpoint.account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
                const bytes = Uint8Array.from(atob(pem), char => char.charCodeAt(0));
                signingKey = await crypto.subtle.importKey('pkcs8', bytes,
                    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
            } catch { throw new Error(VERTEX_COPY.invalidPrivateKey); }
        }
        signal?.throwIfAborted();
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'RS256', typ: 'JWT', ...(endpoint.account.private_key_id ? { kid: endpoint.account.private_key_id } : {}) };
        const unsigned = `${encodeJson(header)}.${encodeJson({ iss: endpoint.account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
        const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, encoder.encode(unsigned));
        signal?.throwIfAborted();
        const response = await fetch(TOKEN_URL, {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(new Uint8Array(signature))}` }),
        });
        if (!response.ok) {
            // Never echo an OAuth response that could contain the submitted assertion.
            throw Object.assign(new Error(`${VERTEX_COPY.tokenFailed}（HTTP ${response.status}）`), { status: response.status });
        }
        const data = await response.json();
        if (typeof data.access_token !== 'string' || !data.access_token || data.token_type?.toLowerCase() !== 'bearer'
            || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error(VERTEX_COPY.invalidToken);
        signal?.throwIfAborted();
        token = data.access_token;
        expiresAt = Date.now() + data.expires_in * 1000;
        return { Authorization: `Bearer ${token}` };
    }
    return async signal => {
        signal?.throwIfAborted();
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal?.addEventListener('abort', abort, { once: true });
        try {
            return await runWithAbortDeadline(authorize, { controller, timeoutMs, timeoutMessage: VERTEX_COPY.tokenTimeout });
        } finally { signal?.removeEventListener('abort', abort); }
    };
}
