import { extension_settings, getContext } from '../../../../../../../../extensions.js';
import { isGenerating } from '../../../../../shared/common/sillytavern-generation-state.js';
import { getScriptsByType, saveScriptsByType, SCRIPT_TYPES } from '../../../../../../../../extensions/regex/engine.js';
import { repairDiceDisplayRules } from './display-rule.js';
import { showDiceDisplayRule } from './managed-rule-display.js';
import { isDiceTargetCurrent, type DiceChat, type DiceHostMessage, type DiceTarget } from './message-records.js';
import type { DiceHostWait, DiceHostBlocker } from '../application/host-wait.js';

export interface DiceHostContext {
    chat: DiceHostMessage[]; chatId: string; groupId?: string; characterId?: number;
    name2: string; characters: Record<string, { avatar: string; name: string }>;
    streamingProcessor?: { messageId: number; isStopped: boolean; isFinished: boolean; onStopStreaming(): void } | null;
    generate(type: string, options?: Record<string, unknown>): Promise<unknown>;
}
export const diceHostContext = () => getContext() as unknown as DiceHostContext;

export function isDiceMessageBeingEdited(index?: number): boolean {
    const message = index === undefined ? '#chat .mes' : `#chat .mes[mesid="${index}"]`;
    return !!document.querySelector(`${message} .edit_textarea, ${message} .reasoning_edit_textarea`);
}

export function captureDiceChat(): DiceChat | null {
    const context = diceHostContext();
    if (!context.chatId) { return null; }
    const groupId = context.groupId === undefined || context.groupId === null ? undefined : String(context.groupId);
    // The wrapper clears characterId when it ends. Its last message retains the host's avatar identity.
    const characterId = context.characterId ?? (groupId ? Object.keys(context.characters).find(id =>
        context.characters[id].avatar === context.chat.at(-1)?.original_avatar) : undefined);
    const character = context.characters[String(characterId)];
    if (!groupId && !character?.avatar) { return null; }
    return { key: `${groupId ? 'group' : 'character'}:${groupId || character.avatar}:${context.chatId}`,
        chat: context.chat, chatId: context.chatId, groupId, characterId: Number(characterId),
        characterName: character?.name ?? context.name2, avatar: character?.avatar ?? '' };
}

export async function ensureDiceDisplayRule(): Promise<void> {
    if ((extension_settings.disabledExtensions as string[]).includes('regex')) { throw new Error('请先启用酒馆的正则扩展，再开启行动检定。'); }
    const repaired = repairDiceDisplayRules(getScriptsByType(SCRIPT_TYPES.GLOBAL));
    // Native GLOBAL setter schedules its own settings save; it is not a disk acknowledgement.
    if (repaired) { await saveScriptsByType(repaired as ReturnType<typeof getScriptsByType>, SCRIPT_TYPES.GLOBAL); }
    showDiceDisplayRule(document);
}

export async function waitForDiceHost(target: DiceTarget, signal: AbortSignal, inGroup: boolean,
    readBlocker: () => DiceHostBlocker | null = () => isGenerating() ? 'generation' : null,
    report?: (wait: DiceHostWait) => void): Promise<void> {
    const started = Date.now();
    let previous: DiceHostWait | undefined;
    while (true) {
        if (signal.aborted || !isDiceTargetCurrent(captureDiceChat(), target)) { throw new Error('聊天或回复已变化。'); }
        if (isDiceMessageBeingEdited(target.index)) { throw new Error('请先结束消息编辑。'); }
        // Observe native generation/save cleanup without clearing its flags or processor.
        const blocker = inGroup ? null : readBlocker();
        const blockers = blocker ? [blocker] : [];
        if (!blockers.length) { return; }
        const now = Date.now();
        const wait = { blockers, elapsedSeconds: Math.floor((now - started) / 1000) };
        if (!previous || previous.elapsedSeconds !== wait.elapsedSeconds || previous.blockers.join() !== blockers.join()) {
            report?.(wait);
            previous = wait;
        }
        await new Promise<void>((resolve, reject) => {
            const cancel = () => { globalThis.clearTimeout(timer); reject(new Error('已停止')); };
            const timer = globalThis.setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 40);
            signal.addEventListener('abort', cancel, { once: true });
        });
    }
}
