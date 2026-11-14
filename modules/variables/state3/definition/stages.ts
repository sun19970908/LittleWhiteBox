import type { Definition, Diagnostic, Path, UpdateStage } from '../types.js';
import { contains, overlaps } from '../engine/data.js';
import { reject } from '../engine/diagnostics.js';

export const modelSource = (stage: UpdateStage) => `model:${stage}`;
export function allowsStage(definition: Definition, item: { stages?: UpdateStage[] }, stage?: UpdateStage): boolean {
    return stage === undefined || definition.updates.includes(stage) && (item.stages ?? definition.updates).includes(stage);
}
export function checkStages(definition: Definition) {
    const check = (item: { stages?: UpdateStage[] }, detail: { action?: string; path?: Path }) => {
        if (definition.updates.length > 1 && !item.stages) {reject('stage-missing', detail);}
        if (item.stages?.some(stage => !definition.updates.includes(stage))) {reject('stage-unknown', detail);}
    };
    definition.actions.forEach(action => check(action, { action: action.id }));
    definition.access.filter(entry => entry.direct).forEach(entry => check(entry, { path: entry.path }));
}
// Tool exposure and staged input validation share both the decision and its cause.
export function directWriteIssue(definition: Definition, path: Path, stage?: UpdateStage): Diagnostic | undefined {
    const derived = definition.rules.find(rule => rule.kind === 'derive' && overlaps(rule.path, path));
    if (derived) {return { code: 'derived-write', path, blockedPath: derived.path, rule: derived.id };}
    const access = definition.access.filter(entry => overlaps(entry.path, path));
    const covering = access.filter(entry => contains(entry.path, path) && entry.direct);
    const blocked = access.find(entry => !entry.direct);
    if (!covering.length || blocked) {return { code: 'direct-not-allowed', path, ...(blocked ? { blockedPath: blocked.path } : {}) };}
    if (stage && (!covering.some(entry => allowsStage(definition, entry, stage)) || access.some(entry => !allowsStage(definition, entry, stage)))) {
        const allowedStages = definition.updates.filter(candidate => covering.some(entry => allowsStage(definition, entry, candidate))
            && access.every(entry => allowsStage(definition, entry, candidate)));
        return { code: allowedStages.length ? 'direct-other-stage' : 'direct-not-allowed', path, stage, allowedStages };
    }
}
export function canWriteDirect(definition: Definition, path: Path, stage?: UpdateStage): boolean {
    return !directWriteIssue(definition, path, stage);
}
