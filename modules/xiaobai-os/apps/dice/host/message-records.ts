import { DICE_MESSAGE_KEY, parseDiceRecords } from '../domain/check-records.js';
import { stripCheckMarkers } from '../domain/check-marker.js';
import type { DiceCandidate } from '../application/action-check-session.js';
export type { DiceCandidate } from '../application/action-check-session.js';
import { jsonValuesEqual } from '../../../host/json-values-equal.js';
import type { ActionCheckRule } from '../types.js';
import type { Coc7Sheet } from '../domain/coc7-sheet.js';

export interface DiceHostMessage {
    mes: string;
    name?: string;
    is_user?: boolean;
    is_system?: boolean;
    extra?: Record<string, unknown>;
    swipe_id?: number;
    swipes?: string[];
    swipe_info?: { extra?: Record<string, unknown>; [key: string]: unknown }[];
    [key: string]: unknown;
}

export interface DiceChat {
    key: string;
    chat: DiceHostMessage[];
    chatId: string;
    groupId?: string;
    characterId: number;
    characterName: string;
    avatar: string;
}

export interface DiceTarget {
    source: DiceChat;
    message: DiceHostMessage;
    index: number;
    swipe: number;
    body: string;
    records: unknown;
    generatedFrom: number;
    rule: ActionCheckRule;
    coc7Sheet?: Coc7Sheet | null;
}

export function readDiceRecords(message: DiceHostMessage): unknown {
    return message.extra?.[DICE_MESSAGE_KEY];
}

export function captureDiceTarget(source: DiceChat, index: number, generatedFrom: number, rule: ActionCheckRule = 'd20', coc7Sheet: Coc7Sheet | null = null): DiceTarget | null {
    const message = source.chat[index];
    if (!message || message.is_user || message.is_system || typeof message.mes !== 'string') { return null; }
    return { source, message, index, swipe: message.swipe_id ?? 0, body: message.mes,
        records: structuredClone(readDiceRecords(message)), generatedFrom, rule, coc7Sheet };
}

export function isDiceTargetCurrent(source: DiceChat | null, target: DiceTarget, body = target.body): boolean {
    return !!source && source.key === target.source.key && source.chat === target.source.chat
        && source.chat.length === target.index + 1 && source.chat[target.index] === target.message
        && (target.message.swipe_id ?? 0) === target.swipe && target.message.mes === body;
}

function writeRecords(message: { extra?: Record<string, unknown> }, records: unknown): void {
    if (records === undefined) {
        if (message.extra) { delete message.extra[DICE_MESSAGE_KEY]; }
    } else {
        message.extra ??= {};
        message.extra[DICE_MESSAGE_KEY] = structuredClone(records);
    }
}

/** Apply once to the live message. Native chat saving owns persistence. */
export function applyDiceCandidate(source: DiceChat | null, target: DiceTarget, candidate: DiceCandidate): void {
    if (!isDiceTargetCurrent(source, target) || !jsonValuesEqual(readDiceRecords(target.message), target.records)) {
        throw new Error('dice_target_changed');
    }
    const message = target.message;
    const swipeInfo = message.swipe_info?.[target.swipe];
    message.mes = candidate.body;
    writeRecords(message, candidate.records);
    if (message.swipes) { message.swipes[target.swipe] = candidate.body; }
    if (swipeInfo) { writeRecords(swipeInfo, candidate.records); }
}

/** Called only for a newly generated swipe, after the host has copied the previous extra. */
export function clearNewDiceSwipe(message: DiceHostMessage): void {
    writeRecords(message, undefined);
    const info = message.swipe_info?.[message.swipe_id ?? 0];
    if (info) { writeRecords(info, undefined); }
}

function ownedCheckIds(value: unknown): Set<string> {
    try { return new Set(parseDiceRecords(value).checks.map(record => record.id)); }
    catch { return new Set<string>(); }
}

/** Read-only collection: deletion must not remove the only identifiers needed to clear overrides. */
export function collectDiceCheckIds(messages: DiceHostMessage[]): Set<string> {
    const checkIds = new Set<string>();
    for (const message of messages) {
        for (const id of ownedCheckIds(readDiceRecords(message))) { checkIds.add(id); }
        for (const info of message.swipe_info ?? []) {
            for (const id of ownedCheckIds(info?.extra?.[DICE_MESSAGE_KEY])) { checkIds.add(id); }
        }
    }
    return checkIds;
}

export function clearDiceMessageData(messages: DiceHostMessage[]): Set<DiceHostMessage> {
    const changed = new Set<DiceHostMessage>();
    const clearDisplay = (extra: Record<string, unknown> | undefined, ids: ReadonlySet<string>): boolean => {
        if (typeof extra?.display_text !== 'string') { return false; }
        const text = stripCheckMarkers(extra.display_text, ids);
        if (text === extra.display_text) { return false; }
        extra.display_text = text;
        return true;
    };
    for (const message of messages) {
        const currentIds = ownedCheckIds(readDiceRecords(message));
        const body = stripCheckMarkers(message.mes, currentIds);
        if (body !== message.mes) { message.mes = body; changed.add(message); }
        if (clearDisplay(message.extra, currentIds)) { changed.add(message); }
        if (message.swipes) {
            message.swipes = message.swipes.map((text, index) => stripCheckMarkers(text,
                index === (message.swipe_id ?? 0) ? currentIds : ownedCheckIds(message.swipe_info?.[index]?.extra?.[DICE_MESSAGE_KEY])));
        }
        writeRecords(message, undefined);
        for (const [index, info] of (message.swipe_info ?? []).entries()) {
            if (!info) { continue; }
            clearDisplay(info.extra, index === (message.swipe_id ?? 0) ? currentIds : ownedCheckIds(info.extra?.[DICE_MESSAGE_KEY]));
            writeRecords(info, undefined);
        }
    }
    return changed;
}
