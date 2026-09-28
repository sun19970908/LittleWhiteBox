export interface DepthPromptSlot {
    readonly depth: number;
    readonly role: 'system' | 'user' | 'assistant';
}

export interface PromptInjectionGroup<K extends string = string> {
    readonly id: string;
    readonly slots: Readonly<Record<K, DepthPromptSlot>>;
}

export interface InjectedPrompt extends DepthPromptSlot {
    readonly identifier: string;
    readonly order: number;
    readonly content: string;
}

export interface PromptInjectionHandle<K extends string> {
    set(slot: K, content: string): void;
    dispose(): void;
}

export interface PromptInjectionCapability {
    register<K extends string>(group: PromptInjectionGroup<K>): PromptInjectionHandle<K>;
}

// The policy is an ordered list of purposes, not registration/activation order.
// All slots of one purpose share its order, including slots at different depths.
export function createPromptInjectionRegistry(
    policy: readonly PromptInjectionGroup[],
    publish: (prompt: InjectedPrompt) => void,
) {
    const definitions = new Map<PromptInjectionGroup, Map<string, InjectedPrompt>>();
    const identifiers = new Set<string>();
    const active = new Map<PromptInjectionGroup, Map<string, InjectedPrompt>>();
    for (const [index, group] of policy.entries()) {
        const slots = new Map<string, InjectedPrompt>();
        for (const [slot, placement] of Object.entries(group.slots)) {
            const identifier = `xiaobai_os_${group.id}_${slot}`;
            if (identifiers.has(identifier)) { throw new Error('prompt_injection_duplicate_slot'); }
            identifiers.add(identifier);
            slots.set(slot, { ...placement, identifier, order: 999 - index, content: '' });
        }
        definitions.set(group, slots);
    }

    function clearSlots(slots: Map<string, InjectedPrompt>): void {
        for (const [key, prompt] of slots) {
            if (!prompt.content) { continue; }
            const empty = { ...prompt, content: '' };
            slots.set(key, empty);
            publish(empty);
        }
    }

    return {
        register<K extends string>(group: PromptInjectionGroup<K>): PromptInjectionHandle<K> {
            const definition = definitions.get(group);
            if (!definition) { throw new Error('prompt_injection_unknown_group'); }
            if (active.has(group)) { throw new Error('prompt_injection_duplicate_registration'); }
            const slots = new Map(definition);
            active.set(group, slots);
            return {
                set(slot, content) {
                    if (active.get(group) !== slots) {
                        if (content) { throw new Error('prompt_injection_registration_disposed'); }
                        return;
                    }
                    const previous = slots.get(slot);
                    if (!previous) { throw new Error('prompt_injection_unknown_slot'); }
                    const next = { ...previous, content };
                    slots.set(slot, next);
                    publish(next);
                },
                dispose() {
                    if (active.get(group) !== slots) { return; }
                    clearSlots(slots);
                    active.delete(group);
                },
            };
        },
        snapshot(): InjectedPrompt[] {
            return policy.flatMap(group => [...(active.get(group)?.values() ?? [])].filter(prompt => prompt.content));
        },
        clear() { for (const slots of active.values()) { clearSlots(slots); } },
        dispose() {
            for (const slots of active.values()) { clearSlots(slots); }
            active.clear();
            definitions.clear();
        },
    };
}

export type PromptInjectionRegistry = ReturnType<typeof createPromptInjectionRegistry>;
