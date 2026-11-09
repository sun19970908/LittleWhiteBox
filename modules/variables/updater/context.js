import { getContext } from '../../../../../../extensions.js';
import { ownedRoots, readRecord, readRecords } from '../state2/records.js';
import { decodeStoredVariable, getRootFromPath } from '../state2/executor.js';
import { COPY } from './copy.js';
import { captureContext } from '../shared/context-capture.js';
import { buildUpdateTask } from './handoff.js';
import { getStateInputSchema } from '../state2/json-input.js';
import { exposeUpdateRules } from './world-info.js';

import { passageText } from '../shared/passage.js';
export { passageText } from '../shared/passage.js';

export function latestReply(ctx = getContext()) {
    let floor = (ctx.chat?.length || 0) - 1;
    while (floor >= 0 && ctx.chat[floor].is_user === true && !ctx.chat[floor].is_system) floor--;
    const message = ctx.chat?.[floor];
    if (!message || message.is_user || message.is_system || !message.mes?.trim()) throw new Error(COPY.noReply);
    return { floor, swipeId: message.swipe_id ?? 0, message };
}

export function hasBodyUpdate(message) {
    return readRecord(message)?.entries.some(entry => entry.kind === 'text' && (entry.ops.length || entry.rules?.length)) === true;
}

export function stateMaterial(ctx) {
    const roots = ownedRoots(readRecords(ctx.chat));
    const variables = ctx.chatMetadata.variables || {}, rules = ctx.chatMetadata.LWB_RULES_V2 || {};
    return { values: Object.fromEntries([...roots].filter(root => Object.hasOwn(variables, root))
        .map(root => [root, decodeStoredVariable(variables[root])])),
    constraints: Object.fromEntries(Object.entries(rules).filter(([path]) => roots.has(getRootFromPath(path)))) };
}

export async function collectMaterial(ctx, target, signal) {
    const state = stateMaterial(ctx);
    if (!Object.keys(state.values).length) throw new Error(COPY.noVariables);
    const material = { context: { target: { floor: target.floor, swipeId: target.swipeId }, messages: [] },
        state };
    // Reserve our handoff, current values and tool schema before the host fills
    // the remaining context budget with history. No second message-count cutoff.
    const reservation = buildUpdateTask(material, getStateInputSchema());
    material.context = await captureContext(ctx, target, reservation, passageText, signal, () => exposeUpdateRules(ctx));
    return material;
}
