import type { TavernAssistantPreset } from '../assistant-presets';
export interface ManagerPromptOptions {
    includeMemory?: boolean;
    includeCartography?: boolean;
    includeStatus?: boolean;
    includeTasks?: boolean;
    includeWebSearch?: boolean;
    workMode?: 'accepted-turn' | 'manual-chat';
    playerName?: string;
    hasCommunicationEvidence?: boolean;
}
export interface ManagerDomain {
    title: string;
    injected: string[];
    reads: string[];
    tools: string[];
    focus: string;
    prompt: string;
}
export type ManagerDomainFactory = (preset: Partial<TavernAssistantPreset>, options: ManagerPromptOptions) => ManagerDomain;
