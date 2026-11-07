import { normalizeVertexConfig, parseVertexServiceAccount, VERTEX_PROVIDER, VERTEX_AUTH_MODES, VERTEX_COPY } from '../vertex-config.js';

const prefixFor = scope => scope === 'delegate' ? 'xb-assistant-delegate' : 'xb-assistant';
const pendingImports = new WeakMap();

export function buildVertexSettingsMarkup(scope = 'main') {
    const id = prefixFor(scope);
    return `<div id="${id}-vertex" style="display:none">
        <label><span>${VERTEX_COPY.auth}</span><select id="${id}-vertex-authMode">${VERTEX_AUTH_MODES.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('')}</select></label>
        <label data-vertex-standard><span>${VERTEX_COPY.account}</span><input id="${id}-vertex-serviceAccountJson" type="password" autocomplete="off" spellcheck="false" /></label>
        <label data-vertex-standard><span>${VERTEX_COPY.chooseFile}</span><input id="${id}-vertex-file" type="file" accept=".json,application/json" /></label>
        <label data-vertex-standard><span>${VERTEX_COPY.project}</span><input id="${id}-vertex-projectId" type="text" placeholder="${VERTEX_COPY.projectPlaceholder}" spellcheck="false" /></label>
        <label data-vertex-standard><span>${VERTEX_COPY.location}</span><input id="${id}-vertex-location" type="text" spellcheck="false" /></label>
        <label><span>${VERTEX_COPY.streamArguments}</span><select id="${id}-vertex-streamFunctionCallArguments"><option value="true">${VERTEX_COPY.streamOn}</option><option value="false">${VERTEX_COPY.streamOff}</option></select></label>
    </div>`;
}

export function readVertexSettings(root, value, scope = 'main') {
    const current = normalizeVertexConfig(value);
    const prefix = prefixFor(scope);
    return normalizeVertexConfig(Object.fromEntries(Object.entries(current).map(([key, entry]) =>
        [key, key === 'streamFunctionCallArguments'
            ? (root.querySelector(`#${prefix}-vertex-${key}`)?.value ?? String(entry)) !== 'false'
            : root.querySelector(`#${prefix}-vertex-${key}`)?.value ?? entry])));
}

export function syncVertexSettings(root, provider, value, scope = 'main') {
    const id = prefixFor(scope);
    const vertex = normalizeVertexConfig(value);
    const active = provider === VERTEX_PROVIDER;
    const section = root.querySelector(`#${id}-vertex`);
    if (section) {
        pendingImports.delete(section);
        section.style.display = active ? 'contents' : 'none';
        for (const [key, entry] of Object.entries(vertex)) {
            const input = root.querySelector(`#${id}-vertex-${key}`);
            if (input) input.value = entry;
        }
        for (const label of section.querySelectorAll('[data-vertex-standard]')) label.style.display = vertex.authMode === 'service-account' ? '' : 'none';
    }
    const base = root.querySelector(`#${id}-base-url`)?.closest('label');
    if (base) base.style.display = active && vertex.authMode !== 'relay' ? 'none' : '';
    const key = root.querySelector(`#${id}-api-key`)?.closest('label');
    if (key) key.style.display = active && vertex.authMode === 'service-account' ? 'none' : '';
}

export function bindVertexSettings(root, changed, showError) {
    for (const scope of ['main', 'delegate']) {
        const id = prefixFor(scope);
        for (const key of Object.keys(normalizeVertexConfig())) {
            root.querySelector(`#${id}-vertex-${key}`)?.addEventListener(['authMode', 'streamFunctionCallArguments'].includes(key) ? 'change' : 'input', changed);
        }
        root.querySelector(`#${id}-vertex-file`)?.addEventListener('change', async event => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            const section = root.querySelector(`#${id}-vertex`);
            const request = {};
            pendingImports.set(section, request);
            try {
                const text = await file.text();
                if (!input.isConnected || pendingImports.get(section) !== request) return;
                parseVertexServiceAccount(text);
                root.querySelector(`#${id}-vertex-serviceAccountJson`).value = text;
                changed();
            } catch {
                if (input.isConnected && pendingImports.get(section) === request) showError?.(VERTEX_COPY.invalidAccount);
            }
            finally { input.value = ''; }
        });
    }
}
