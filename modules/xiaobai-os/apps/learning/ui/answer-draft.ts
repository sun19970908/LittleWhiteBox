import type { LearningResponse } from '../../../domains/learning/types.js';

/** Incomplete input belongs to the mounted classroom, not the saved learning file. */
export interface LearningAnswerDraft {
    picked: string[];
    text: string;
    values: Record<string, string>;
    order: string[];
}

export function createLearningAnswerDraft(response: LearningResponse): LearningAnswerDraft {
    return { picked: [], text: '', values: {}, order: response.kind === 'order' ? response.options.map(option => option.id) : [] };
}
