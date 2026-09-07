import { parseLearningAssessment } from './facts.js';
import { learningRecord, learningText } from './profile.js';
import { selectLearningEvidence } from './progress.js';
import { canReadLearningScope, LEARNING_LIMITS as L, type LearningAssessment, type LearningEvidence, type LearningLanguage, type LearningScope } from './types.js';
import { combineLearningScope, learningArray, learningId, requireLearning, uniqueLearning } from './validation.js';

export function learningEvidence(profile: LearningLanguage, attemptId: string): LearningEvidence {
    const unit = profile.unit;
    const attempt = unit?.attempts.find(entry => entry.id === attemptId);
    if (!unit || !attempt) {
        const archived = profile.items.flatMap(item => item.evidence).find(entry => entry.attempt.id === attemptId);
        requireLearning(archived, 'attemptId', 'Select a current attempt or retained learning evidence');
        return structuredClone(archived);
    }
    const exercise = unit.exercises.find(entry => entry.id === attempt.exerciseId)!;
    const assessment = unit.assessments.find(entry => entry.attemptId === attemptId)!;
    return structuredClone({ unitId: unit.id, scope: assessment.scope, exercise,
        materials: unit.materials.filter(material => exercise.materialIds.includes(material.id)), attempt, assessment });
}

/** Replacing feedback also replaces every representative copy of that same attempt. */
export function replaceLearningAssessment(profile: LearningLanguage, assessment: LearningAssessment): void {
    const unit = profile.unit;
    if (unit?.attempts.some(entry => entry.id === assessment.attemptId)) {
        const index = unit.assessments.findIndex(entry => entry.attemptId === assessment.attemptId);
        if (index < 0) { unit.assessments.push(assessment); } else { unit.assessments[index] = assessment; }
    }
    for (const item of profile.items) {
        item.evidence = item.evidence.map(entry => entry.attempt.id === assessment.attemptId
            ? { ...entry, assessment: structuredClone(assessment), scope: structuredClone(assessment.scope) } : entry);
    }
}

export function assessLearning(profile: LearningLanguage, args: unknown, options: {
    attemptId: string; review: boolean; inputScope: LearningScope; osId: string; createId: () => string;
}): { profile: LearningLanguage; ids: string[] } {
    const input = learningRecord(args, 'LearningAssess', ['attemptId', 'verdict', 'understanding', 'expression', 'guidance', 'items']);
    const attemptId = learningId(input.attemptId, 'attemptId');
    requireLearning(attemptId === options.attemptId, 'attemptId', 'This action evaluates its submitted attempt');
    const next = structuredClone(profile);
    const unit = next.unit;
    const currentAttempt = unit?.attempts.find(entry => entry.id === attemptId);
    const archived = currentAttempt ? null : next.items.flatMap(item => item.evidence).find(entry => entry.attempt.id === attemptId);
    const attempt = currentAttempt ?? archived?.attempt;
    requireLearning(attempt && canReadLearningScope(attempt.scope, options.osId), 'attemptId', 'Submit and save an available learner answer before evaluation');
    const scope = combineLearningScope(attempt.scope, options.inputScope);
    const { items: rawItems, ...rawAssessment } = input;
    const prior = currentAttempt ? unit!.assessments.find(entry => entry.attemptId === attemptId) : archived?.assessment;
    const evidenceOnly = prior && Object.keys(rawAssessment).length === 1;
    const assessment = evidenceOnly ? prior : parseLearningAssessment({ ...rawAssessment, scope });
    requireLearning(!prior || options.review || JSON.stringify(prior) === JSON.stringify(assessment), 'attemptId', 'Existing feedback can be changed in an explicit review');
    const changes = learningArray(rawItems ?? [], 'items', (value, path) => {
        const item = learningRecord(value, path, ['itemId', 'label']);
        return { itemId: item.itemId === undefined ? null : learningId(item.itemId, `${path}.itemId`),
            label: item.label === undefined ? null : learningText(item.label, `${path}.label`, L.goal) };
    }, L.itemChanges);
    uniqueLearning(changes.flatMap(item => item.itemId === null ? [] : [item.itemId]), 'items');
    replaceLearningAssessment(next, assessment);
    const evidence = learningEvidence(next, attemptId);
    const ids = [attemptId];
    for (const change of changes) {
        let item = change.itemId === null ? next.items.find(entry => entry.label === change.label
            && entry.skill === evidence.exercise.skill && JSON.stringify(entry.scope) === JSON.stringify(scope))
            : next.items.find(entry => entry.id === change.itemId);
        requireLearning(change.itemId === null || item, 'items.itemId', 'Reference an existing learning item');
        if (!item) {
            requireLearning(change.label, 'items.label', 'A new learning item needs a focused label');
            item = { id: options.createId(), label: change.label, scope, skill: evidence.exercise.skill, evidence: [] };
            next.items.push(item);
        }
        requireLearning(item.skill === evidence.exercise.skill, 'items.itemId', 'This attempt must train the same skill');
        if (change.label !== null && change.label !== item.label) {
            requireLearning(canReadLearningScope(item.scope, options.osId), 'items.label', 'A label from another story cannot be changed here');
            item.label = change.label;
            item.scope = combineLearningScope(item.scope, scope);
        }
        item.evidence = selectLearningEvidence([...item.evidence.filter(entry => entry.attempt.id !== attemptId), evidence]);
        ids.push(item.id);
    }
    return { profile: next, ids };
}
