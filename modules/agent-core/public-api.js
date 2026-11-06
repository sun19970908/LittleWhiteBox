import { resolveActiveProviderConfig } from './provider-resolution.js';
import { buildProviderAssistantToolCallMessage, buildProviderToolResultMessage, resolveResultToolCalls } from './runtime/protocol.js';
import { isWebConfigured, resolveWebProvider } from './web/settings.js';
import { fetchWebContents, searchWeb } from './web/retrieval.js';
import { buildWebSearchToolResult, getWebFetchToolDefinition, getWebSearchToolDefinition } from './web/tools.js';

const ERRORS = Object.freeze({
    AGENT_DISABLED: 'LittleWhiteBox is disabled.',
    AGENT_ABORTED: 'The request was aborted.',
    AGENT_SESSION_DISPOSED: 'The session is closed.',
    AGENT_SESSION_BUSY: 'The session already has a request in progress.',
    AGENT_INVALID_INPUT: 'Invalid public Agent API input.',
    AGENT_DELEGATE_NOT_CONFIGURED: 'The delegate API is not configured.',
    AGENT_NOT_CONFIGURED: 'The selected API has no model configured.',
    AGENT_REQUEST_FAILED: 'The Agent request failed.',
});

function failure(code, message = ERRORS[code]) {
    const error = Object.assign(new Error(message), { code });
    if (code === 'AGENT_ABORTED') Object.defineProperty(error, 'name', { value: 'AbortError', configurable: true });
    return error;
}

function requireInput(condition) {
    if (!condition) throw failure('AGENT_INVALID_INPUT');
}

function isObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || (Object.getPrototypeOf(prototype) === null
        && Object.prototype.toString.call(value) === '[object Object]');
}

// Reject values JSON.stringify would silently drop, coerce, or execute (toJSON/getters).
function cloneJson(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        requireInput(Number.isFinite(value) && !Object.is(value, -0));
        return value;
    }
    requireInput(Array.isArray(value) || isObject(value));
    requireInput(!ancestors.has(value));
    ancestors.add(value);
    const keys = Reflect.ownKeys(value);
    requireInput(keys.every(key => typeof key === 'string'));
    const entries = keys.filter(key => !(Array.isArray(value) && key === 'length')).map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        requireInput(descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
        return [key, cloneJson(descriptor.value, ancestors)];
    });
    let result;
    if (Array.isArray(value)) {
        requireInput(entries.length === value.length && entries.every(([key], index) => key === String(index)));
        result = entries.map(([, item]) => item);
    } else {
        result = Object.fromEntries(entries);
    }
    ancestors.delete(value);
    return result;
}

function validateOptions(value, keys) {
    requireInput(isObject(value) && Object.keys(value).every(key => keys.includes(key)));
}

function validateSignal(signal) {
    requireInput(signal === undefined || (signal !== null && typeof signal.aborted === 'boolean'
        && typeof signal.addEventListener === 'function' && typeof signal.removeEventListener === 'function'));
}

function validateChat(input) {
    validateOptions(input, ['systemPrompt', 'messages', 'tools', 'toolChoice', 'signal', 'onStreamProgress']);
    requireInput(input.systemPrompt === undefined || typeof input.systemPrompt === 'string');
    requireInput(Array.isArray(input.messages));
    requireInput(input.tools === undefined || Array.isArray(input.tools));
    requireInput(input.toolChoice === undefined || ['auto', 'required', 'none'].includes(input.toolChoice));
    requireInput(input.onStreamProgress === undefined || typeof input.onStreamProgress === 'function');
    validateSignal(input.signal);
    const messages = cloneJson(input.messages);
    for (const message of messages) {
        requireInput(isObject(message) && ['system', 'user', 'assistant', 'tool'].includes(message.role));
        requireInput(typeof message.content === 'string' || (message.role === 'user' && Array.isArray(message.content)));
        if (message.role === 'tool') {
            requireInput(typeof message.tool_call_id === 'string' && Boolean(message.tool_call_id.trim()));
            let content;
            try { content = JSON.parse(message.content); } catch { throw failure('AGENT_INVALID_INPUT'); }
            requireInput(isObject(content));
        }
        if (message.tool_calls !== undefined) {
            requireInput(message.role === 'assistant' && Array.isArray(message.tool_calls));
            for (const call of message.tool_calls) {
                requireInput(isObject(call) && typeof call.id === 'string' && Boolean(call.id.trim())
                    && call.type === 'function' && isObject(call.function)
                    && typeof call.function.name === 'string' && Boolean(call.function.name.trim())
                    && typeof call.function.arguments === 'string');
            }
        }
    }
    const tools = cloneJson(input.tools ?? []);
    for (const tool of tools) {
        requireInput(isObject(tool) && tool.type === 'function' && isObject(tool.function)
            && typeof tool.function.name === 'string' && Boolean(tool.function.name.trim())
            && isObject(tool.function.parameters));
    }
    requireInput(input.toolChoice !== 'required' || tools.length > 0);
    return { systemPrompt: input.systemPrompt ?? '', messages, tools, toolChoice: input.toolChoice ?? 'auto' };
}

function collectSecrets(value, secrets, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
        if (/api_?key$/i.test(key) && typeof item === 'string' && item) secrets.add(item);
        else if (/baseurl$/i.test(key) && typeof item === 'string' && item) {
            secrets.add(item);
            try {
                const url = new URL(item);
                for (const credential of [url.username, url.password]) {
                    if (credential) secrets.add(decodeURIComponent(credential));
                }
                for (const [name, credential] of url.searchParams) {
                    if (credential && /key|token|secret|password|authorization/i.test(name)) secrets.add(credential);
                }
            } catch (error) {
                if (!(error instanceof TypeError) && !(error instanceof URIError)) throw error;
                // Malformed URLs are already protected by whole-setting redaction.
                continue;
            }
        } else if (item && typeof item === 'object') collectSecrets(item, secrets, seen);
    }
}

function redact(text, secrets) {
    let result = text;
    const values = [...secrets].flatMap(secret => [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)]);
    for (const secret of [...new Set(values)].sort((left, right) => right.length - left.length)) {
        result = result.split(secret).join('[redacted]');
    }
    return result;
}

function publicError(error, secrets) {
    const rawCode = typeof error?.code === 'string' ? error.code : '';
    const safeCode = redact(rawCode, secrets);
    const code = /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(safeCode) ? safeCode : 'AGENT_REQUEST_FAILED';
    const message = redact(typeof error?.message === 'string' ? error.message : ERRORS.AGENT_REQUEST_FAILED, secrets);
    const result = failure(code, message);
    const status = error?.status ?? error?.httpStatus;
    if (Number.isInteger(status) && status >= 100 && status <= 599) result.status = status;
    return result;
}

function streamDraft(payload) {
    return {
        ...(['waiting', 'thinking', 'tool-call', 'replying'].includes(payload?.activity) ? { activity: payload.activity } : {}),
        ...(typeof payload?.text === 'string' ? { text: payload.text } : {}),
        ...(Array.isArray(payload?.thoughts) ? { thoughts: payload.thoughts.map(item => ({ label: String(item?.label ?? ''), text: String(item?.text ?? '') })) } : {}),
        ...(Array.isArray(payload?.toolCalls) ? { toolCalls: payload.toolCalls.map(call => ({
            id: String(call?.id ?? ''), name: String(call?.name ?? ''), arguments: String(call?.arguments ?? ''),
            ...(Object.hasOwn(call ?? {}, 'providerId') ? { providerId: String(call.providerId ?? '') } : {}),
        })) } : {}),
        toolCallDraft: true,
    };
}

function publicResult(result, config) {
    const toolCalls = resolveResultToolCalls(result, config);
    const reply = buildProviderAssistantToolCallMessage(result, toolCalls);
    // SDK optional fields may be undefined; replay is a portable JSON value, not an SDK instance.
    const jsonCopy = value => JSON.parse(JSON.stringify(value));
    return {
        text: String(result.text ?? ''),
        thoughts: streamDraft({ thoughts: result.thoughts ?? [] }).thoughts,
        toolCalls: cloneJson(toolCalls),
        reply: jsonCopy(reply),
        provider: String(result.provider ?? config.provider),
        model: String(result.model ?? config.model),
        ...(result.usage !== undefined ? { usage: jsonCopy(result.usage) } : {}),
        ...(result.finishReason !== undefined ? { finishReason: jsonCopy(result.finishReason) } : {}),
        ...(result.completion !== undefined ? { completion: jsonCopy(result.completion) } : {}),
        ...(result.truncated !== undefined ? { truncated: Boolean(result.truncated) } : {}),
    };
}

/** Creates the stable public facade and a separate host-only invalidation hook. */
export function createPublicAgentApi({ isEnabled, loadSettings, loadCore }) {
    requireInput(typeof isEnabled === 'function' && typeof loadSettings === 'function' && typeof loadCore === 'function');
    const sessions = new Set();
    const operations = new Set();
    let corePromise;

    function enabled() { return isEnabled() === true; }

    function operation(signals = [], allowDisabled = false) {
        const controller = new AbortController();
        const cleanups = [];
        let abortCode = 'AGENT_ABORTED';
        const op = {
            signal: controller.signal,
            abort(code = 'AGENT_ABORTED') {
                if (controller.signal.aborted) return;
                abortCode = code;
                controller.abort();
            },
            check() {
                if (controller.signal.aborted) throw failure(abortCode);
                if (!allowDisabled && !enabled()) throw failure('AGENT_DISABLED');
            },
            async wait(action) {
                op.check();
                let onAbort;
                const aborted = new Promise((_, reject) => {
                    onAbort = () => reject(failure(abortCode));
                    controller.signal.addEventListener('abort', onAbort, { once: true });
                });
                try {
                    const result = await Promise.race([Promise.resolve().then(() => { op.check(); return action(); }), aborted]);
                    op.check();
                    return result;
                } finally {
                    controller.signal.removeEventListener('abort', onAbort);
                }
            },
            finish() {
                for (const cleanup of cleanups) cleanup();
                operations.delete(op);
            },
        };
        for (const signal of signals) {
            if (!signal) continue;
            const onAbort = () => op.abort();
            if (signal.aborted) op.abort();
            else {
                signal.addEventListener('abort', onAbort, { once: true });
                cleanups.push(() => signal.removeEventListener('abort', onAbort));
            }
        }
        operations.add(op);
        return op;
    }

    async function readSettings(op, secrets) {
        op.check();
        const settings = await op.wait(loadSettings);
        collectSecrets(settings, secrets);
        return settings;
    }

    function getCore() {
        corePromise ??= Promise.resolve().then(loadCore).catch(error => { corePromise = undefined; throw error; });
        return corePromise;
    }

    async function getStatus() {
        const secrets = new Set();
        const op = operation([], true);
        try {
            const settings = await readSettings(op, secrets);
            const main = resolveActiveProviderConfig(settings);
            const delegate = resolveActiveProviderConfig(settings, { role: 'delegate' });
            op.check();
            return {
                enabled: enabled(),
                main: { configured: Boolean(main.model.trim()), provider: main.provider, model: main.model },
                delegate: { configured: settings.delegateConfigured === true && Boolean(delegate.model.trim()), provider: delegate.provider, model: delegate.model },
                web: { configured: isWebConfigured(settings), provider: resolveWebProvider(settings).id },
            };
        } catch (error) { throw publicError(error, secrets); }
        finally { op.finish(); }
    }

    async function openSession(options = {}) {
        const secrets = new Set();
        let op;
        try {
            validateOptions(options, ['api', 'signal']);
            requireInput(options.api === undefined || ['main', 'delegate'].includes(options.api));
            validateSignal(options.signal);
            op = operation([options.signal]);
            op.check();
            const settings = await readSettings(op, secrets);
            if (options.api === 'delegate' && settings.delegateConfigured !== true) throw failure('AGENT_DELEGATE_NOT_CONFIGURED');
            const resolved = resolveActiveProviderConfig(settings, { role: options.api ?? 'main' });
            collectSecrets(resolved, secrets);
            // Resolution may contain undefined temperature; JSON snapshots retain its omission.
            const config = JSON.parse(JSON.stringify(resolved));
            if (!config.model.trim()) throw failure('AGENT_NOT_CONFIGURED');
            op.check();
            const lifetime = new AbortController();
            let closedCode = '';
            let busy = false;
            let adapter;
            const onAbort = () => close('AGENT_ABORTED');
            function close(code = 'AGENT_SESSION_DISPOSED') {
                if (closedCode) return;
                closedCode = code;
                lifetime.abort();
                options.signal?.removeEventListener('abort', onAbort);
                sessions.delete(close);
            }
            function check() {
                if (closedCode) throw failure(closedCode);
                if (!enabled()) throw failure('AGENT_DISABLED');
            }
            options.signal?.addEventListener('abort', onAbort, { once: true });
            sessions.add(close);
            const session = Object.freeze({
                async chat(input) {
                    let request;
                    let acquired = false;
                    let acceptingProgress = true;
                    try {
                        check();
                        if (busy) throw failure('AGENT_SESSION_BUSY');
                        const task = validateChat(input);
                        busy = true;
                        acquired = true;
                        request = operation([lifetime.signal, input.signal]);
                        request.check();
                        const core = await request.wait(getCore);
                        check();
                        adapter ??= core.createAgentAdapter(JSON.parse(JSON.stringify(config)));
                        request.check();
                        check();
                        const result = await request.wait(() => adapter.chat({
                            ...task,
                            temperature: config.sendTemperature === false ? undefined : config.temperature,
                            maxTokens: config.maxTokens,
                            reasoning: cloneJson(config.reasoning),
                            signal: request.signal,
                            ...(input.onStreamProgress ? { onStreamProgress(payload) {
                                if (!acceptingProgress) return;
                                request.check();
                                check();
                                input.onStreamProgress(streamDraft(payload));
                            } } : {}),
                        }));
                        check();
                        const output = publicResult(result, config);
                        request.check();
                        check();
                        return output;
                    } catch (error) {
                        if (closedCode) throw publicError(failure(closedCode), secrets);
                        throw publicError(error, secrets);
                    } finally {
                        acceptingProgress = false;
                        request?.finish();
                        if (acquired) busy = false;
                    }
                },
                toolResult(call, value) {
                    try {
                        check();
                        requireInput(isObject(call) && typeof call.id === 'string' && Boolean(call.id.trim())
                            && typeof call.name === 'string' && Boolean(call.name.trim()));
                        const result = cloneJson(value);
                        return buildProviderToolResultMessage({
                            toolCallId: call.id, toolName: call.name,
                            content: JSON.stringify(isObject(result) ? result : { result }),
                        });
                    } catch (error) { throw publicError(error, secrets); }
                },
                dispose() { close(); },
            });
            op.check();
            return session;
        } catch (error) { throw publicError(error, secrets); }
        finally { op?.finish(); }
    }

    async function webRequest(input, kind) {
        const secrets = new Set();
        let op;
        try {
            validateOptions(input, kind === 'search' ? ['query', 'maxResults', 'signal'] : ['urls', 'signal']);
            validateSignal(input.signal);
            if (kind === 'search') {
                requireInput(typeof input.query === 'string' && Boolean(input.query.trim()));
                requireInput(input.maxResults === undefined || (Number.isInteger(input.maxResults) && input.maxResults > 0));
            } else {
                requireInput(Array.isArray(input.urls) && input.urls.every(url => typeof url === 'string'));
            }
            op = operation([input.signal]);
            const settings = await readSettings(op, secrets);
            op.check();
            const result = kind === 'search'
                ? buildWebSearchToolResult(input.query, await op.wait(() => searchWeb(settings, { query: input.query, maxResults: input.maxResults, signal: op.signal })), input.maxResults)
                : await op.wait(() => fetchWebContents(settings, cloneJson(input.urls), { signal: op.signal }));
            const output = cloneJson(kind === 'search' ? result : { ok: result.failures.length === 0, ...result });
            op.check();
            return output;
        } catch (error) { throw publicError(error, secrets); }
        finally { op?.finish(); }
    }

    const api = Object.freeze({
        getStatus,
        openSession,
        web: Object.freeze({
            getTools() { return cloneJson([getWebSearchToolDefinition(), getWebFetchToolDefinition()]); },
            search(input) { return webRequest(input, 'search'); },
            fetch(input) { return webRequest(input, 'fetch'); },
        }),
    });
    return Object.freeze({ api, cancelAll() {
        for (const close of [...sessions]) close('AGENT_DISABLED');
        for (const op of [...operations]) op.abort('AGENT_DISABLED');
    } });
}
