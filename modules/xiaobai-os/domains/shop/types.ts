export const SHOP_SCHEMA_VERSION = 2 as const;
export const SHOP_EFFECT_RECEIPT_VERSION = 1 as const;

export type ShopDuration =
    | { kind: 'replies'; applications: number }
    | { kind: 'manual' }
    | { kind: 'permanent' };

export type ShopCategory =
    | 'emotion'
    | 'memory'
    | 'information'
    | 'behavior'
    | 'scene'
    | 'ultimate'
    | 'world-cognition'
    | 'physics';

export type ShopInputKey = 'targetName' | 'identity' | 'appearance' | 'era' | 'location' | 'weather' | 'rule';
export type ShopStacking = 'global-single' | 'per-parameters';

export interface ShopInputDefinition {
    key: ShopInputKey;
    promptTag: string;
    label: string;
    placeholder: string;
    required: true;
    maxLength: number;
}

export interface ShopItemContract {
    id: string;
    name: string;
    icon: string;
    category: ShopCategory;
    price: number;
    description: string;
    duration: ShopDuration;
    inputs: readonly ShopInputDefinition[];
    stacking: ShopStacking;
    purchaseLimit?: number;
    trustedRule: string;
    groupFooterRule?: string;
    expirationRule?: string;
    deactivationRule?: string;
}

export interface ShopEffectReceipt {
    schemaVersion: typeof SHOP_EFFECT_RECEIPT_VERSION;
    activeActivationIds: string[];
    transitionActivationIds: string[];
}

export type ShopAction =
    | { kind: 'purchase'; itemId: string }
    | {
        kind: 'activate';
        itemId: string;
        activationId: string;
        parameters: Record<string, string>;
    }
    | { kind: 'deactivate'; itemId: string; activationId: string }
    | {
        kind: 'deliver';
        consumedActivationIds: string[];
        transitionActivationIds: string[];
    };

export interface ShopEvent {
    revision: number;
    eventId: string;
    actionId: string;
    action: ShopAction;
    createdAt: number;
}

export interface ShopDomainV2 {
    schemaVersion: typeof SHOP_SCHEMA_VERSION;
    events: ShopEvent[];
}

export interface ShopInventoryEntry {
    itemId: string;
    quantity: number;
    purchasedCount: number;
}

export interface ShopActivation {
    activationId: string;
    itemId: string;
    parameters: Record<string, string>;
    activatedByEventId: string;
    activatedAtRevision: number;
    appliedCount: number;
    deactivatedByEventId?: string;
    transitionDeliveredByEventId?: string;
}

export interface ShopStateProjection {
    revision: number;
    eventId: string;
    inventory: Record<string, ShopInventoryEntry>;
    activations: ShopActivation[];
}

export interface ShopCasToken {
    expectedRevision: number;
    expectedEventId: string;
}

export interface ShopCommandContext extends ShopCasToken {
    actionId: string;
}

export interface PurchaseShopItemInput extends ShopCommandContext {
    itemId: string;
}

export interface ActivateShopItemInput extends ShopCommandContext {
    itemId: string;
    activationId: string;
    parameters?: Record<string, unknown>;
}

export interface DeactivateShopItemInput extends ShopCommandContext {
    itemId: string;
    activationId: string;
}

export interface DeliverShopEffectsInput extends ShopCommandContext {
    receipt: ShopEffectReceipt;
}

export interface ShopCommandResult {
    domain: ShopDomainV2;
    event: ShopEvent;
    projection: ShopStateProjection;
    created: boolean;
}

export interface ShopDeliveryResult {
    domain: ShopDomainV2;
    event: ShopEvent | null;
    projection: ShopStateProjection;
    created: boolean;
}

export interface ShopCommandDependencies {
    now?: () => number;
    createEventId?: () => string;
}

export type ShopGenerationMode = 'normal' | 'regenerate' | 'swipe' | 'continue';

export type ShopErrorCode =
    | 'shop_invalid_catalog'
    | 'shop_item_id_required'
    | 'shop_item_missing'
    | 'shop_item_not_for_sale'
    | 'shop_action_required'
    | 'shop_action_conflict'
    | 'shop_activation_id_required'
    | 'shop_activation_id_conflict'
    | 'shop_parameters_invalid'
    | 'shop_quantity_insufficient'
    | 'shop_purchase_limit_reached'
    | 'shop_activation_duplicate'
    | 'shop_activation_missing'
    | 'shop_activation_not_manual'
    | 'shop_activation_not_active'
    | 'shop_revision_conflict'
    | 'shop_event_id_conflict'
    | 'shop_effect_receipt_invalid'
    | 'shop_invalid_context'
    | 'shop_invalid_domain'
    | 'shop_unsupported_version';

export class ShopError extends Error {
    readonly code: ShopErrorCode;

    constructor(code: ShopErrorCode, message: string = code) {
        super(message);
        this.name = 'ShopError';
        this.code = code;
    }
}
