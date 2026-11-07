import { getContext } from '../../../../../../extensions.js';
import { ownedRoots, readRecord, readRecords } from '../state2/records.js';
import { decodeStoredVariable, getRootFromPath } from '../state2/executor.js';
import { COPY } from './copy.js';
import { captureContext } from './context-capture.js';
import { buildUpdateTask } from './preset.js';
import { getStateInputSchema } from '../state2/json-input.js';

// V5 interleaves prose and private status blocks. Text outside its wrappers is
// still prose (for example, additions from other extensions).
export function passageText(text) {
    let prose = '', cursor = 0, status = false;
    for (const match of String(text || '').matchAll(/<(\/?)(meta-chapter|meta-status)>|<!--meta-write:complete-->/g)) {
        if (!status) prose += text.slice(cursor, match.index);
        if (match[2]) status = !match[1] && match[2] === 'meta-status';
        cursor = match.index + match[0].length;
    }
    if (!status) prose += String(text || '').slice(cursor);
    return prose.trim();
}

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

export function stateMaterial(ctx, snapshot) {
    const roots = ownedRoots(readRecords(ctx.chat));
    return { values: Object.fromEntries([...roots].filter(root => Object.hasOwn(snapshot.variables, root))
        .map(root => [root, decodeStoredVariable(snapshot.variables[root])])),
    constraints: Object.fromEntries(Object.entries(snapshot.rules).filter(([path]) => roots.has(getRootFromPath(path)))) };
}

export async function collectMaterial(ctx, target, snapshot, settings, signal) {
    const state = stateMaterial(ctx, snapshot);
    if (!Object.keys(state.values).length) throw new Error(COPY.noVariables);
    const material = { context: { target: { floor: target.floor, swipeId: target.swipeId }, messages: [] },
        state };
    // Reserve our handoff, current values and tool schema before the host fills
    // the remaining context budget with history. No second message-count cutoff.
    const reservation = buildUpdateTask(settings.preset, material, getStateInputSchema());
    material.context = await captureContext(ctx, target, reservation, passageText, signal, snapshot);
    return material;
}
