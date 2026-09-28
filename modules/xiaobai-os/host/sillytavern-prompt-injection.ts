import { extension_prompt_roles, extension_prompt_types, extension_prompts, main_api, setExtensionPrompt } from '../../../../../../../script.js';
import { promptManager } from '../../../../../../openai.js';
import { INJECTION_POSITION } from '../../../../../../PromptManager.js';
import { createModuleEvents, event_types } from '../../../core/event-manager.js';
import { observeGenerateInterceptors } from '../../../shared/common/generate-interceptor.js';
import type { PromptInjectionHost } from '../capabilities/prompt-injection/index.js';
import { createPromptInjectionRuntime, type InjectionPromptManager, type InjectionRun } from './prompt-injection-runtime.js';
import { getSillyTavernChatIdentity } from './sillytavern-context.js';

// ST 1.14 / 1.18 expose the same collection boundary. The extension API has
// no injection_order, so only text completion uses its original IN_CHAT path.
export function createSillyTavernPromptInjectionHost(): PromptInjectionHost {
    const extensionPrompts = extension_prompts as Record<string, unknown>;
    const published = new Map<string, unknown>();
    const release = (key: string) => {
        if (published.has(key) && extensionPrompts[key] === published.get(key)) { delete extensionPrompts[key]; }
        published.delete(key);
    };
    const runtime = createPromptInjectionRuntime({
        manager: promptManager as unknown as InjectionPromptManager,
        absolutePosition: INJECTION_POSITION.ABSOLUTE,
        isChatCompletion: () => main_api === 'openai',
        identity: () => getSillyTavernChatIdentity()?.key ?? null,
        publishText(prompt) {
            release(prompt.identifier);
            if (!prompt.content || main_api === 'openai') { return; }
            const roles = { system: extension_prompt_roles.SYSTEM, user: extension_prompt_roles.USER, assistant: extension_prompt_roles.ASSISTANT };
            setExtensionPrompt(prompt.identifier, prompt.content, extension_prompt_types.IN_CHAT, prompt.depth, false, roles[prompt.role]);
            published.set(prompt.identifier, extensionPrompts[prompt.identifier]);
        },
        clearText() { for (const key of published.keys()) { release(key); } },
    });
    let unsubscribe: (() => void) | null = null;
    return {
        publish: runtime.publish,
        start(registry) {
            runtime.start(registry);
            const events = createModuleEvents('xiaobaiOsPromptInjection');
            const unobserve = observeGenerateInterceptors((event: { phase: string; type: string; run: InjectionRun }) => {
                if (event.phase === 'dispatch-start') { runtime.begin(event.type, event.run); }
                else if (event.phase === 'dispatch-end') { runtime.ready(event.run); }
            });
            unsubscribe = () => { unobserve(); events.cleanup(); };
            events.on(event_types.GENERATION_STARTED, (_type: unknown, _options: unknown, dryRun: unknown) => { if (!dryRun) { runtime.clear(); } });
            events.on(event_types.GENERATE_AFTER_DATA, (_data: unknown, dryRun: unknown) => { if (!dryRun) { runtime.clear(); } });
            for (const event of [event_types.GENERATION_STOPPED, event_types.GENERATION_ENDED, event_types.CHAT_CHANGED]) {
                events.on(event, runtime.clear);
            }
        },
        stop() { unsubscribe?.(); unsubscribe = null; runtime.stop(); },
    };
}
