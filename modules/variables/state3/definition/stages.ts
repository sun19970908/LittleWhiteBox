import type { Definition, Path, UpdateStage } from '../types.js';
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
    definition.access.filter(entry => entry.write.includes('direct')).forEach(entry => check(entry, { path: entry.path }));
}
export function canWriteDirect(definition: Definition, path: Path, stage?: UpdateStage): boolean {
    return definition.access.some(entry => entry.write.includes('direct') && allowsStage(definition, entry, stage) && contains(entry.path, path))
        && !definition.access.some(entry => (!entry.write.includes('direct') || !allowsStage(definition, entry, stage)) && overlaps(entry.path, path))
        && !definition.rules.some(rule => rule.kind === 'derive' && overlaps(rule.path, path));
}
