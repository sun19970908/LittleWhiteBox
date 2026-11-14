import type { Compiled, Definition, Json, Path, UpdateStage } from '../types.js';
import { allowsStage, directWriteIssue } from '../definition/stages.js';
import { changes, contains, overlaps } from './data.js';
import { reject } from './diagnostics.js';

export function checkDirectWrite(definition: Definition, path: Path, stage: UpdateStage) {
    const issue = directWriteIssue(definition, path, stage);
    if (issue) {reject(issue.code, { ...issue, stage });}
}

export function checkAction(compiled: Compiled, id: string, stage?: UpdateStage) {
    const action = compiled.actions.get(id);
    if (!action) {reject('action-missing', { action: id });}
    if (!allowsStage(compiled.definition, action, stage)) {
        reject('action-other-stage', { action: id, stage,
            allowedStages: compiled.definition.updates.filter(candidate => allowsStage(compiled.definition, action, candidate)) });
    }
    return action;
}

// Unstaged card APIs keep checking actual changed leaves, so replacing an object
// without changing its protected children remains valid. Model stage checks above
// inspect the submitted path, just as the tool projection does.
export function authorize(compiled: Compiled, before: Json, after: Json, action?: string) {
    for (const change of changes(before, after)) {
        const derived = compiled.rules.find(rule => rule.kind === 'derive' && overlaps(rule.path, change.path));
        if (derived) {
            reject('derived-write', { path: change.path, rule: derived.id, actor: action ?? 'direct' });
        }
        if (action === undefined) {
            const access = compiled.definition.access.filter(entry => contains(entry.path, change.path));
            if (!access.length || access.some(entry => !entry.direct)) {
                reject('direct-not-allowed', { path: change.path, actor: 'direct' });
            }
        }
    }
}
