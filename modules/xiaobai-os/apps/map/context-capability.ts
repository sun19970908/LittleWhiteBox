import {
    createCapabilityToken,
    type CapabilityRegistration,
} from '../../kernel/capability-registry.js';
import type { CapabilityToken } from '../../kernel/contracts.js';

export interface MapContextCapability {
    readPromptContext(): string;
    registerProvider(provider: () => string): () => void;
}

export const MAP_CONTEXT_CAPABILITY: CapabilityToken<MapContextCapability> =
    createCapabilityToken('map.prompt-context');

export function createMapContextCapabilityRegistration(): CapabilityRegistration<MapContextCapability> {
    let provider: (() => string) | null = null;
    return {
        token: MAP_CONTEXT_CAPABILITY,
        ownerId: 'map',
        dependencies: [],
        install: () => Object.freeze({
            readPromptContext: () => {
                try {
                    return provider?.() ?? '';
                } catch (error) {
                    console.error('[LittleWhiteBox] Map 可选上下文读取失败，已忽略', error);
                    return '';
                }
            },
            registerProvider(next: () => string) {
                if (provider) { throw new Error('map_context_provider_already_registered'); }
                provider = next;
                return () => {
                    if (provider === next) { provider = null; }
                };
            },
        }),
        dispose: () => { provider = null; },
    };
}
