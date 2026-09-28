import type { InjectedPrompt, PromptInjectionRegistry } from '../capabilities/prompt-injection/registry.js';

export interface InjectionPromptManager {
    activeCharacter: unknown;
    serviceSettings: { prompts: unknown; prompt_order: unknown };
    getPromptCollection(type?: string): { add(...prompts: unknown[]): void };
    preparePrompt(prompt: Record<string, unknown>): unknown;
}

export interface InjectionRun { readonly signal: AbortSignal }

export function createPromptInjectionRuntime(dependencies: {
    manager: InjectionPromptManager;
    absolutePosition: number;
    isChatCompletion(): boolean;
    identity(): string | null;
    publishText(prompt: InjectedPrompt): void;
    clearText(): void;
}) {
    const { manager } = dependencies;
    let registry: PromptInjectionRegistry | null = null;
    let restore: (() => void) | null = null;
    let pending: {
        run: InjectionRun; type: string; ready: boolean; identity: string;
        character: unknown; prompts: unknown; order: unknown;
    } | null = null;

    function clear(): void {
        pending?.run.signal.removeEventListener('abort', clear);
        pending = null;
        registry?.clear();
        dependencies.clearText();
    }

    return {
        publish(prompt: InjectedPrompt) {
            if (!prompt.content || pending && !pending.run.signal.aborted && dependencies.identity() === pending.identity) {
                dependencies.publishText(prompt);
            }
        },
        start(source: PromptInjectionRegistry) {
            registry = source;
            const original = manager.getPromptCollection;
            let attached = true;
            const wrapped: InjectionPromptManager['getPromptCollection'] = function (this: InjectionPromptManager, type) {
                const collection = original.call(this, type);
                const request = pending;
                // A preview can read the same snapshot; it never consumes it. Quiet/raw
                // calls and an auxiliary host using its own preset/character do not own it.
                if (attached && request?.ready && !request.run.signal.aborted && dependencies.isChatCompletion()
                    && String(type || 'normal') === request.type && dependencies.identity() === request.identity
                    && this.activeCharacter === request.character
                    && this.serviceSettings.prompts === request.prompts && this.serviceSettings.prompt_order === request.order) {
                    for (const entry of source.snapshot()) {
                        collection.add(this.preparePrompt({
                            identifier: entry.identifier, content: entry.content, role: entry.role,
                            injection_position: dependencies.absolutePosition,
                            injection_depth: entry.depth, injection_order: entry.order,
                        }));
                    }
                }
                return collection;
            };
            manager.getPromptCollection = wrapped;
            restore = () => {
                attached = false;
                // Another extension may have wrapped ours after installation.
                if (manager.getPromptCollection === wrapped) { manager.getPromptCollection = original; }
            };
        },
        begin(type: string, run: InjectionRun) {
            clear();
            const identity = dependencies.identity();
            if (!identity || run.signal.aborted || !['', 'normal', 'regenerate', 'swipe', 'continue'].includes(type)) { return; }
            pending = { run, type: type || 'normal', ready: false, identity,
                character: manager.activeCharacter, prompts: manager.serviceSettings.prompts, order: manager.serviceSettings.prompt_order };
            run.signal.addEventListener('abort', clear, { once: true });
        },
        ready(run: InjectionRun) {
            if (pending?.run !== run) { return; }
            if (run.signal.aborted) { clear(); }
            else { pending.ready = true; }
        },
        clear,
        stop() {
            clear();
            restore?.();
            restore = null;
            registry = null;
        },
    };
}
