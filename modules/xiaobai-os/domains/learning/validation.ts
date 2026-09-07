import { learningRecord, learningText, LearningValidationError } from './profile.js';
import type { LearningScope } from './types.js';

export function requireLearning(condition: unknown, path: string, message: string): asserts condition {
    if (!condition) { throw new LearningValidationError(path, message); }
}
export function learningArray<T>(value: unknown, path: string, parse: (value: unknown, path: string) => T, max = Infinity): T[] {
    requireLearning(Array.isArray(value) && value.length <= max, path, `Expected an array with at most ${max} entries`);
    return value.map((item, index) => parse(item, `${path}[${index}]`));
}
export function learningId(value: unknown, path: string): string { return learningText(value, path, 128); }
export function uniqueLearning(values: string[], path: string): void {
    requireLearning(new Set(values).size === values.length, path, 'Each ID must occur once');
}
export function learningIds(value: unknown, path: string, max = Infinity): string[] {
    const ids = learningArray(value, path, learningId, max);
    uniqueLearning(ids, path);
    return ids;
}
export function learningEnum<const T extends readonly string[]>(value: unknown, path: string, choices: T): T[number] {
    requireLearning(typeof value === 'string' && choices.includes(value), path, `Expected ${choices.join(', ')}`);
    return value;
}
export function learningBoolean(value: unknown, path: string): boolean {
    requireLearning(typeof value === 'boolean', path, 'Expected a boolean');
    return value;
}
export function learningInteger(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    requireLearning(Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max, path, `Expected an integer from ${min} to ${max}`);
    return value as number;
}
export function learningTimestamp(value: unknown, path: string): string {
    const text = learningText(value, path, 24);
    requireLearning(Number.isFinite(Date.parse(text)) && new Date(text).toISOString() === text, path, 'Expected an ISO timestamp');
    return text;
}
export function parseLearningScope(value: unknown, path: string): LearningScope {
    const item = learningRecord(value, path, ['kind', 'osId']);
    if (item.kind === 'public') {
        requireLearning(!('osId' in item), path, 'Public content has no story identity');
        return { kind: 'public' };
    }
    requireLearning(item.kind === 'story', `${path}.kind`, 'Expected public or story');
    return { kind: 'story', osId: learningId(item.osId, `${path}.osId`) };
}
export function sameLearningScope(left: LearningScope, right: LearningScope): boolean {
    return left.kind === right.kind && (left.kind === 'public' || (right.kind === 'story' && left.osId === right.osId));
}
export function combineLearningScope(left: LearningScope, right: LearningScope): LearningScope {
    if (left.kind === 'public') { return right; }
    requireLearning(right.kind === 'public' || right.osId === left.osId, 'scope', 'Content belongs to another story');
    return left;
}
