import type { PromptContextInput } from './types.js';

type UnknownRecord = Record<string, unknown>;

interface HostCharacter extends UnknownRecord {
    readonly avatar?: unknown;
    readonly name?: unknown;
    readonly description?: unknown;
    readonly personality?: unknown;
    readonly scenario?: unknown;
    readonly data?: unknown;
}

interface HostGroup extends UnknownRecord {
    readonly id?: unknown;
    readonly members?: unknown;
    readonly disabled_members?: unknown;
}

export interface PromptCharacterHostContext {
    readonly groupId?: unknown;
    readonly characterId?: unknown;
    readonly characters?: unknown;
    readonly groups?: unknown;
    readonly name2?: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asCharacters(value: unknown): HostCharacter[] {
    if (Array.isArray(value)) {return value.filter(isRecord) as HostCharacter[];}
    if (!isRecord(value)) {return [];}
    return Object.values(value).filter(isRecord) as HostCharacter[];
}

function characterField(character: HostCharacter, field: 'description' | 'personality' | 'scenario'): unknown {
    const data = isRecord(character.data) ? character.data : {};
    return character[field] ?? data[field] ?? '';
}

function promptCharacter(character: HostCharacter, fallbackName?: unknown) {
    const key = typeof character.avatar === 'string' ? character.avatar.trim() : '';
    if (!key) {return null;}
    return {
        characterKey: key,
        displayName: character.name ?? fallbackName,
        description: characterField(character, 'description'),
        personality: characterField(character, 'personality'),
        scenario: characterField(character, 'scenario'),
    };
}

export function selectPromptCharacters(context: PromptCharacterHostContext): PromptContextInput['characters'] {
    const characters = asCharacters(context.characters);
    const groupId = context.groupId === null || context.groupId === undefined ? '' : String(context.groupId);
    if (groupId) {
        const groups = Array.isArray(context.groups) ? context.groups.filter(isRecord) as HostGroup[] : [];
        const group = groups.find(candidate => String(candidate.id ?? '') === groupId);
        const disabled = new Set(Array.isArray(group?.disabled_members)
            ? group.disabled_members.map(member => String(member))
            : []);
        const members = Array.isArray(group?.members) ? group.members.map(member => String(member)) : [];
        return members
            .filter(member => !disabled.has(member))
            .flatMap((member) => {
                const character = characters.find(candidate => String(candidate.avatar ?? '') === member);
                const selected = character ? promptCharacter(character) : null;
                return selected ? [selected] : [];
            });
    }
    const rawCharacterId = context.characterId;
    const selected = rawCharacterId === null || rawCharacterId === undefined
        ? undefined
        : (Array.isArray(context.characters)
            ? context.characters[Number(rawCharacterId)]
            : isRecord(context.characters) ? context.characters[String(rawCharacterId)] : undefined);
    if (!isRecord(selected)) {return [];}
    const character = promptCharacter(selected as HostCharacter, context.name2);
    return character ? [character] : [];
}

