import { parseLearningData } from '../../../domains/learning/data.js';
import { learningRecord, learningText, LearningValidationError } from '../../../domains/learning/profile.js';
import type { LearningData } from '../../../domains/learning/types.js';

export const LEARNING_FILENAME = 'LittleWhiteBox_Learning.json';
export const MAX_LEARNING_WRITE_BYTES = 8 * 1024 * 1024;

export interface LearningDocument {
    schemaVersion: 1;
    revision: number;
    commitId: string;
    data: LearningData;
}

export function parseLearningDocument(value: unknown): LearningDocument {
    const item = learningRecord(value, 'document', ['schemaVersion', 'revision', 'commitId', 'data']);
    if (item.schemaVersion !== 1 || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1) {
        throw new LearningValidationError('document', 'Expected current schema and a positive safe revision');
    }
    return { schemaVersion: 1, revision: item.revision as number,
        commitId: learningText(item.commitId, 'commitId', 128), data: parseLearningData(item.data) };
}

export function sameLearningDocument(left: LearningDocument | null, right: LearningDocument | null): boolean {
    // Parsed documents have canonical key order; compare content as well as identity.
    return JSON.stringify(left) === JSON.stringify(right);
}
