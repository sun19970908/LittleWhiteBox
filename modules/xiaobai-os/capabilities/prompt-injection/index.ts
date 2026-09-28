import { createCapabilityToken, type CapabilityRegistration } from '../../kernel/capability-registry.js';
import { createPromptInjectionRegistry, type InjectedPrompt, type PromptInjectionCapability, type PromptInjectionGroup, type PromptInjectionRegistry } from './registry.js';

export type { PromptInjectionCapability, PromptInjectionGroup } from './registry.js';
export const PROMPT_INJECTION_CAPABILITY = createCapabilityToken<PromptInjectionCapability>('prompt.injection');

export interface PromptInjectionHost {
    publish(prompt: InjectedPrompt): void;
    start(registry: PromptInjectionRegistry): void;
    stop(): void;
}

export function createPromptInjectionCapabilityRegistration(
    policy: readonly PromptInjectionGroup[],
    createHost: () => PromptInjectionHost,
): CapabilityRegistration<PromptInjectionCapability> {
    let release: (() => void) | undefined;
    return {
        token: PROMPT_INJECTION_CAPABILITY,
        ownerId: 'prompt-injection',
        dependencies: [],
        install() {
            const host = createHost();
            const registry = createPromptInjectionRegistry(policy, host.publish);
            try { host.start(registry); }
            catch (error) { registry.dispose(); host.stop(); throw error; }
            release = () => { registry.dispose(); host.stop(); };
            return { register: registry.register };
        },
        dispose() { release?.(); release = undefined; },
    };
}
