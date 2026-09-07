import { parseShopEffectReceipt } from '../../../domains/shop/invariants.js';
import type { ShopEffectReceipt } from '../../../domains/shop/types.js';
import type { XiaobaiOsChatSurface } from '../../../host/sillytavern-context.js';
import { jsonValuesEqual } from '../../../host/json-values-equal.js';

const SHOP_EFFECT_RECEIPT_KEY = 'xiaobaiOsShopEffects';
type UnknownRecord = Record<string, unknown>;

interface ShopHostMessage extends UnknownRecord {
    is_user?: boolean;
    is_system?: boolean;
    mes?: unknown;
    extra?: unknown;
    swipe_id?: unknown;
    swipe_info?: unknown;
}

export interface ShopConversationSnapshot {
    identityKey: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        shopEffectReceipt?: unknown;
    }>;
}

export interface ShopMessageReceiptBinding {
    rollback: () => void;
}

interface ShopMessageReceiptsDependencies {
    captureChatSurface: () => XiaobaiOsChatSurface | null;
}

export interface ShopMessageReceipts {
    captureConversation: () => ShopConversationSnapshot | null;
    bind: (input: {
        chatIdentity: string;
        messageId: number;
        receipt: ShopEffectReceipt;
    }) => ShopMessageReceiptBinding;
}

interface ReceiptSnapshot {
    originalExtra: unknown;
    hadReceipt: boolean;
    previousReceipt?: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asMessage(value: unknown): ShopHostMessage | null {
    return isRecord(value) ? value as ShopHostMessage : null;
}

function activeSwipe(message: ShopHostMessage): UnknownRecord | null {
    const swipeId = Number(message.swipe_id);
    if (!Number.isSafeInteger(swipeId) || !Array.isArray(message.swipe_info)) {return null;}
    const entry = message.swipe_info[swipeId];
    return isRecord(entry) ? entry : null;
}

function readReceipt(message: ShopHostMessage): unknown {
    const messageExtra = isRecord(message.extra) ? message.extra : null;
    if (messageExtra && Object.hasOwn(messageExtra, SHOP_EFFECT_RECEIPT_KEY)) {
        return messageExtra[SHOP_EFFECT_RECEIPT_KEY];
    }
    const swipeExtra = activeSwipe(message);
    const extra = swipeExtra && isRecord(swipeExtra.extra) ? swipeExtra.extra : null;
    return extra?.[SHOP_EFFECT_RECEIPT_KEY];
}

function snapshotReceipt(target: UnknownRecord): ReceiptSnapshot {
    const originalExtra = target.extra;
    const extra = isRecord(originalExtra) ? originalExtra : null;
    const hadReceipt = !!extra && Object.hasOwn(extra, SHOP_EFFECT_RECEIPT_KEY);
    return {
        originalExtra,
        hadReceipt,
        ...(hadReceipt ? { previousReceipt: structuredClone(extra?.[SHOP_EFFECT_RECEIPT_KEY]) } : {}),
    };
}

function installReceipt(target: UnknownRecord, receipt: ShopEffectReceipt): void {
    const extra = isRecord(target.extra) ? target.extra : {};
    target.extra = extra;
    extra[SHOP_EFFECT_RECEIPT_KEY] = structuredClone(receipt);
}

function restoreReceipt(target: UnknownRecord, snapshot: ReceiptSnapshot, receipt: ShopEffectReceipt): void {
    const extra = isRecord(target.extra) ? target.extra : null;
    if (!extra || !jsonValuesEqual(extra[SHOP_EFFECT_RECEIPT_KEY], receipt)) {return;}
    if (snapshot.hadReceipt) {
        extra[SHOP_EFFECT_RECEIPT_KEY] = structuredClone(snapshot.previousReceipt);
    } else {
        delete extra[SHOP_EFFECT_RECEIPT_KEY];
    }
    if (!isRecord(snapshot.originalExtra) && Object.keys(extra).length === 0) {
        target.extra = snapshot.originalExtra;
    }
}

export function createShopMessageReceipts({
    captureChatSurface,
}: ShopMessageReceiptsDependencies): ShopMessageReceipts {
    function captureConversation(): ShopConversationSnapshot | null {
        const surface = captureChatSurface();
        if (!surface) {return null;}
        return {
            identityKey: surface.identityKey,
            messages: surface.messages.map((value) => {
                const message = asMessage(value);
                if (!message) {return { role: 'system' as const, content: '' };}
                const receipt = readReceipt(message);
                return {
                    role: message.is_system === true ? 'system' : message.is_user === true ? 'user' : 'assistant',
                    content: typeof message.mes === 'string' ? message.mes : '',
                    ...(receipt === undefined ? {} : { shopEffectReceipt: structuredClone(receipt) }),
                };
            }),
        };
    }

    function bind({
        chatIdentity,
        messageId,
        receipt: inputReceipt,
    }: {
        chatIdentity: string;
        messageId: number;
        receipt: ShopEffectReceipt;
    }): ShopMessageReceiptBinding {
        if (!Number.isSafeInteger(messageId) || messageId < 0) {
            throw new Error('shop_generation_message_invalid');
        }
        const receipt = parseShopEffectReceipt(inputReceipt);
        const surface = captureChatSurface();
        const message = asMessage(surface?.messages[messageId]);
        if (
            !surface
            || surface.identityKey !== chatIdentity
            || !message
            || message.is_user === true
            || message.is_system === true
        ) {
            throw new Error('shop_generation_chat_changed');
        }
        const swipe = activeSwipe(message);
        const messageSnapshot = snapshotReceipt(message);
        const swipeSnapshot = swipe ? snapshotReceipt(swipe) : null;
        installReceipt(message, receipt);
        if (swipe) {installReceipt(swipe, receipt);}

        return Object.freeze({
            rollback() {
                const current = captureChatSurface();
                if (current?.identityKey !== chatIdentity || current.messages[messageId] !== message) {return;}
                restoreReceipt(message, messageSnapshot, receipt);
                if (swipe && activeSwipe(message) === swipe && swipeSnapshot) {
                    restoreReceipt(swipe, swipeSnapshot, receipt);
                }
            },
        });
    }

    return Object.freeze({ captureConversation, bind });
}
