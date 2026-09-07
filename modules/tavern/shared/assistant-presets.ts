import { buildDefaultStateMemoryPrompt, buildDefaultCharacterMemoryPrompt } from './memory/manager-domain';
import { buildDefaultStatusPanelPrompt } from './status/manager-domain';

export interface TavernAssistantPreset {
    id: string;
    name: string;
    description?: string;
    statePrompt: string;
    characterPrompt: string;
    statusPrompt: string;
    updatedAt?: number;
}

type AssistantPresetInput = Partial<TavernAssistantPreset>;

export const DEFAULT_TAVERN_ASSISTANT_PRESET_ID = 'littlewhitebox-assistant-default';
export const DEFAULT_TAVERN_ASSISTANT_PRESET_VERSION = '2026-09-domain-owned-manager-v5';

function normalizeText(value: unknown = ''): string {
    return String(value || '').trim();
}

export function createDefaultTavernAssistantPreset(): TavernAssistantPreset {
    return {
        id: DEFAULT_TAVERN_ASSISTANT_PRESET_ID,
        name: '默认助手预设',
        description: '记忆管理员的默认维护规则。',
        statePrompt: buildDefaultStateMemoryPrompt(),
        characterPrompt: buildDefaultCharacterMemoryPrompt(),
        statusPrompt: buildDefaultStatusPanelPrompt(),
    };
}

export function normalizeTavernAssistantPreset(input: AssistantPresetInput = {}): TavernAssistantPreset {
    const fallback = createDefaultTavernAssistantPreset();
    const id = normalizeText(input.id) || fallback.id;
    const name = normalizeText(input.name) || fallback.name;
    const normalized: TavernAssistantPreset = {
        id,
        name,
        description: String(input.description || ''),
        statePrompt: normalizeText(input.statePrompt) || fallback.statePrompt,
        characterPrompt: normalizeText(input.characterPrompt) || fallback.characterPrompt,
        statusPrompt: normalizeText(input.statusPrompt) || fallback.statusPrompt,
        updatedAt: Number(input.updatedAt) || undefined,
    };
    return normalized;
}
