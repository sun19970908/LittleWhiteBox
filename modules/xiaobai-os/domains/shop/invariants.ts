import { getShopContract } from './catalog.js';
import {
    SHOP_EFFECT_RECEIPT_VERSION,
    SHOP_SCHEMA_VERSION,
    ShopError,
    type ShopAction,
    type ShopActivation,
    type ShopItemContract,
    type ShopDomainV2,
    type ShopEffectReceipt,
    type ShopEvent,
} from './types.js';

const MAX_DATE_MS = 8_640_000_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        throw new ShopError('shop_invalid_domain', `${field} has unexpected or missing fields`);
    }
}

function requireCanonicalId(value: unknown, field: string, maxLength: number): string {
    if (
        typeof value !== 'string'
        || !value
        || value !== value.trim()
        || Array.from(value).length > maxLength
        || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
    ) {
        throw new ShopError('shop_invalid_domain', `${field} must be a canonical non-empty string`);
    }
    return value;
}

function requireCanonicalIdList(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length > 100) {
        throw new ShopError('shop_invalid_domain', `${field} must be an id array`);
    }
    const ids = value.map((entry, index) => requireCanonicalId(entry, `${field}.${index}`, 200));
    if (new Set(ids).size !== ids.length) {
        throw new ShopError('shop_invalid_domain', `${field} must not contain duplicates`);
    }
    return ids;
}

function normalizeText(value: unknown, maxLength: number): string {
    const normalized = String(value ?? '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    return Array.from(normalized).slice(0, maxLength).join('');
}

/** Reduces untrusted values to the declared catalog fields and canonical text. */
export function normalizeShopParameters(
    item: Readonly<ShopItemContract>,
    rawParameters: Record<string, unknown> = {},
): Record<string, string> {
    const source = isRecord(rawParameters) ? rawParameters : {};
    const parameters: Record<string, string> = {};
    for (const definition of item.inputs) {
        const value = normalizeText(source[definition.key], definition.maxLength);
        if (definition.required && !value) {
            throw new ShopError(
                'shop_parameters_invalid',
                `required parameter is missing: ${item.id}.${definition.key}`,
            );
        }
        if (value) {parameters[definition.key] = value;}
    }
    return parameters;
}

export function shopActivationKey(
    item: Readonly<ShopItemContract>,
    parameters: Record<string, string>,
): string {
    return `${item.id}:${JSON.stringify(item.inputs.map((definition) => [
        definition.key,
        parameters[definition.key] || '',
    ]))}`;
}

function parametersAreCanonical(item: Readonly<ShopItemContract>, value: unknown): value is Record<string, string> {
    if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== 'string')) {return false;}
    try {
        const normalized = normalizeShopParameters(item, value);
        const keys = Object.keys(value).sort();
        const normalizedKeys = Object.keys(normalized).sort();
        return keys.length === normalizedKeys.length
            && keys.every((key, index) => key === normalizedKeys[index] && value[key] === normalized[key]);
    } catch {
        return false;
    }
}

function validateAction(value: unknown): ShopAction {
    if (!isRecord(value)) {throw new ShopError('shop_invalid_domain', 'event action must be an object');}
    const kind = value.kind;
    if (kind === 'purchase') {
        requireExactKeys(value, ['kind', 'itemId'], 'purchase action');
        const item = getShopContract(requireCanonicalId(value.itemId, 'action.itemId', 80));
        return { kind, itemId: item.id };
    }
    if (kind === 'activate') {
        requireExactKeys(value, ['kind', 'itemId', 'activationId', 'parameters'], 'activate action');
        const item = getShopContract(requireCanonicalId(value.itemId, 'action.itemId', 80));
        const activationId = requireCanonicalId(value.activationId, 'action.activationId', 200);
        if (!parametersAreCanonical(item, value.parameters)) {
            throw new ShopError('shop_invalid_domain', `activation parameters are not canonical: ${item.id}`);
        }
        return { kind, itemId: item.id, activationId, parameters: value.parameters };
    }
    if (kind === 'deactivate') {
        requireExactKeys(value, ['kind', 'itemId', 'activationId'], 'deactivate action');
        const item = getShopContract(requireCanonicalId(value.itemId, 'action.itemId', 80));
        return {
            kind,
            itemId: item.id,
            activationId: requireCanonicalId(value.activationId, 'action.activationId', 200),
        };
    }
    if (kind === 'deliver') {
        requireExactKeys(value, ['kind', 'consumedActivationIds', 'transitionActivationIds'], 'deliver action');
        const consumedActivationIds = requireCanonicalIdList(value.consumedActivationIds, 'action.consumedActivationIds');
        const transitionActivationIds = requireCanonicalIdList(
            value.transitionActivationIds,
            'action.transitionActivationIds',
        );
        if (consumedActivationIds.length === 0 && transitionActivationIds.length === 0) {
            throw new ShopError('shop_invalid_domain', 'deliver action must advance at least one effect');
        }
        if (consumedActivationIds.some(id => transitionActivationIds.includes(id))) {
            throw new ShopError('shop_invalid_domain', 'one delivery cannot consume and transition the same activation');
        }
        return { kind, consumedActivationIds, transitionActivationIds };
    }
    throw new ShopError('shop_invalid_domain', 'event action kind is invalid');
}

function validateEventShape(value: unknown, expectedRevision: number): ShopEvent {
    if (!isRecord(value)) {throw new ShopError('shop_invalid_domain', 'shop event must be an object');}
    requireExactKeys(value, ['revision', 'eventId', 'actionId', 'action', 'createdAt'], 'shop event');
    if (!Number.isSafeInteger(value.revision) || value.revision !== expectedRevision) {
        throw new ShopError('shop_invalid_domain', 'event revisions must be contiguous from 1');
    }
    if (
        !Number.isSafeInteger(value.createdAt)
        || Number(value.createdAt) < 0
        || Number(value.createdAt) > MAX_DATE_MS
    ) {
        throw new ShopError('shop_invalid_domain', 'createdAt must be a valid non-negative integer timestamp');
    }
    return {
        revision: Number(value.revision),
        eventId: requireCanonicalId(value.eventId, 'event.eventId', 200),
        actionId: requireCanonicalId(value.actionId, 'event.actionId', 200),
        action: validateAction(value.action),
        createdAt: Number(value.createdAt),
    };
}

function isActive(activation: ShopActivation, item: Readonly<ShopItemContract>): boolean {
    if (item.duration.kind === 'permanent') {return true;}
    if (item.duration.kind === 'manual') {return activation.deactivatedByEventId === undefined;}
    return activation.appliedCount < item.duration.applications;
}

function hasPendingTransition(activation: ShopActivation, item: Readonly<ShopItemContract>): boolean {
    if (activation.transitionDeliveredByEventId) {return false;}
    if (item.duration.kind === 'replies') {
        return activation.appliedCount === item.duration.applications && !!item.expirationRule;
    }
    return item.duration.kind === 'manual' && !!activation.deactivatedByEventId && !!item.deactivationRule;
}

function applyEventState(
    event: ShopEvent,
    quantities: Map<string, number>,
    purchaseCounts: Map<string, number>,
    activations: Map<string, ShopActivation>,
): void {
    const action = event.action;
    if (action.kind === 'purchase') {
        const item = getShopContract(action.itemId);
        const purchasedCount = (purchaseCounts.get(item.id) || 0) + 1;
        if (item.purchaseLimit !== undefined && purchasedCount > item.purchaseLimit) {
            throw new ShopError('shop_invalid_domain', `purchase limit exceeded: ${item.id}`);
        }
        purchaseCounts.set(item.id, purchasedCount);
        quantities.set(item.id, (quantities.get(item.id) || 0) + 1);
        return;
    }
    if (action.kind === 'activate') {
        const item = getShopContract(action.itemId);
        if (activations.has(action.activationId)) {
            throw new ShopError('shop_invalid_domain', `activationId is duplicated: ${action.activationId}`);
        }
        if ((quantities.get(item.id) || 0) < 1) {
            throw new ShopError('shop_invalid_domain', `activation has no inventory: ${item.id}`);
        }
        const activationKey = shopActivationKey(item, action.parameters);
        for (const existing of activations.values()) {
            if (existing.itemId !== item.id || !isActive(existing, item)) {continue;}
            if (item.stacking === 'global-single' || shopActivationKey(item, existing.parameters) === activationKey) {
                throw new ShopError('shop_invalid_domain', `activation scope overlaps: ${item.id}`);
            }
        }
        quantities.set(item.id, (quantities.get(item.id) || 0) - 1);
        activations.set(action.activationId, {
            activationId: action.activationId,
            itemId: item.id,
            parameters: { ...action.parameters },
            activatedByEventId: event.eventId,
            activatedAtRevision: event.revision,
            appliedCount: 0,
        });
        return;
    }
    if (action.kind === 'deactivate') {
        const item = getShopContract(action.itemId);
        const activation = activations.get(action.activationId);
        if (!activation || activation.itemId !== item.id) {
            throw new ShopError('shop_invalid_domain', `deactivation target is missing: ${action.activationId}`);
        }
        if (item.duration.kind !== 'manual' || !isActive(activation, item)) {
            throw new ShopError('shop_invalid_domain', `deactivation target is not an active manual effect: ${action.activationId}`);
        }
        activation.deactivatedByEventId = event.eventId;
        return;
    }
    for (const activationId of action.consumedActivationIds) {
        const activation = activations.get(activationId);
        if (!activation) {throw new ShopError('shop_invalid_domain', `delivery target is missing: ${activationId}`);}
        const item = getShopContract(activation.itemId);
        if (item.duration.kind !== 'replies' || !isActive(activation, item)) {
            throw new ShopError('shop_invalid_domain', `delivery cannot consume effect: ${activationId}`);
        }
        activation.appliedCount += 1;
    }
    for (const activationId of action.transitionActivationIds) {
        const activation = activations.get(activationId);
        if (!activation || !hasPendingTransition(activation, getShopContract(activation.itemId))) {
            throw new ShopError('shop_invalid_domain', `delivery has no pending transition: ${activationId}`);
        }
        activation.transitionDeliveredByEventId = event.eventId;
    }
}

/** Validates both serialized shape and every invariant implied by event replay. */
export function validateShopDomain(value: unknown): asserts value is ShopDomainV2 {
    if (!isRecord(value)) {throw new ShopError('shop_invalid_domain', 'shop domain must be an object');}
    if (value.schemaVersion !== SHOP_SCHEMA_VERSION) {
        throw new ShopError('shop_unsupported_version', 'unsupported shop schema version');
    }
    requireExactKeys(value, ['schemaVersion', 'events'], 'shop domain');
    if (!Array.isArray(value.events)) {throw new ShopError('shop_invalid_domain', 'shop events must be an array');}

    const eventIds = new Set<string>();
    const actionIds = new Set<string>();
    const quantities = new Map<string, number>();
    const purchaseCounts = new Map<string, number>();
    const activations = new Map<string, ShopActivation>();
    for (let index = 0; index < value.events.length; index += 1) {
        const event = validateEventShape(value.events[index], index + 1);
        if (eventIds.has(event.eventId) || actionIds.has(event.actionId)) {
            throw new ShopError('shop_invalid_domain', 'eventId and actionId must be unique');
        }
        eventIds.add(event.eventId);
        actionIds.add(event.actionId);
        applyEventState(event, quantities, purchaseCounts, activations);
    }
}

export function parseShopEffectReceipt(value: unknown): ShopEffectReceipt {
    if (!isRecord(value)) {throw new ShopError('shop_effect_receipt_invalid');}
    try {
        requireExactKeys(
            value,
            ['schemaVersion', 'activeActivationIds', 'transitionActivationIds'],
            'shop effect receipt',
        );
        if (value.schemaVersion !== SHOP_EFFECT_RECEIPT_VERSION) {
            throw new ShopError('shop_effect_receipt_invalid');
        }
        const activeActivationIds = requireCanonicalIdList(value.activeActivationIds, 'receipt.activeActivationIds');
        const transitionActivationIds = requireCanonicalIdList(
            value.transitionActivationIds,
            'receipt.transitionActivationIds',
        );
        if (activeActivationIds.some(id => transitionActivationIds.includes(id))) {
            throw new ShopError('shop_effect_receipt_invalid');
        }
        return { schemaVersion: SHOP_EFFECT_RECEIPT_VERSION, activeActivationIds, transitionActivationIds };
    } catch (error) {
        if (error instanceof ShopError && error.code === 'shop_effect_receipt_invalid') {throw error;}
        throw new ShopError('shop_effect_receipt_invalid');
    }
}
