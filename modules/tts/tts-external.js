import { FREE_DEFAULT_VOICE, FREE_VOICES } from './tts-api.js';

/** Public speech configuration contains only selectable voices, never provider credentials. */
export function readTtsVoices(config) {
    const voices = FREE_VOICES.map(voice => ({
        id: voice.key, name: `${voice.name} · ${voice.tag}`, source: 'free', available: true,
    }));
    const configured = Boolean(config?.volc?.appId && config?.volc?.accessKey);
    for (const voice of config?.volc?.mySpeakers ?? []) {
        if (!voice.value || voices.some(item => item.id === voice.value)) continue;
        voices.push({ id: voice.value, name: voice.name || voice.value, source: 'auth', available: configured });
    }
    const defaultVoice = config?.volc?.defaultSpeaker || FREE_DEFAULT_VOICE;
    if (!voices.some(voice => voice.id === defaultVoice)) {
        voices.push({ id: defaultVoice, name: defaultVoice, source: 'auth', available: configured });
    }
    return { voices, defaultVoice };
}

/** Overrides apply to one request. Omission preserves the main-chat settings. */
export function ttsRequestSettings(config, options) {
    if (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed < 0.5 || options.speed > 2)) {
        throw new Error('合成语速须在 0.5–2 之间');
    }
    if (options.language !== undefined && (typeof options.language !== 'string' || options.language.length > 80)) {
        throw new Error('无效的合成语言');
    }
    return {
        speed: options.speed ?? config.volc?.speechRate,
        language: options.language ?? config.volc?.explicitLanguage,
    };
}

/** Disabling TTS cancels all external downloads, including a late cache result. */
export function createTtsExternalSynthesis({ isEnabled, synthesize }) {
    const requests = new Set();
    let closed = false;
    return {
        async synthesize(text, options = {}) {
            if (closed || !isEnabled()) throw new Error('TTS 模块未启用');
            const controller = new AbortController();
            const abort = () => controller.abort();
            if (options.signal?.aborted) abort();
            else options.signal?.addEventListener('abort', abort, { once: true });
            requests.add(controller);
            try {
                controller.signal.throwIfAborted();
                const blob = await synthesize(text, { ...options, signal: controller.signal });
                controller.signal.throwIfAborted();
                if (closed || !isEnabled()) throw new Error('TTS 模块未启用');
                return blob;
            } finally {
                requests.delete(controller);
                options.signal?.removeEventListener('abort', abort);
            }
        },
        dispose() {
            closed = true;
            for (const request of requests) request.abort();
            requests.clear();
        },
    };
}
