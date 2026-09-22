import { assertJsonValue, cloneJsonValue } from './envelope.js';

/** One user file: a commit includes global partitions and story-owned financial records. */
export interface UserDocument {
    formatVersion: 1;
    revision: number;
    commitId: string;
    partitions: Record<string, unknown>;
    stories: Record<string, Record<string, unknown>>;
}

export const USER_DOCUMENT_FILENAME = 'LittleWhiteBox_User.json';

export function parseUserDocument(value: unknown): UserDocument {
    assertJsonValue(value);
    const record = value as Partial<UserDocument> | null;
    const dictionary = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
    if (!record || Object.keys(record).sort().join(',') !== 'commitId,formatVersion,partitions,revision,stories'
        || record.formatVersion !== 1 || !Number.isSafeInteger(record.revision) || record.revision! < 1
        || typeof record.commitId !== 'string' || !record.commitId
        || !dictionary(record.partitions) || !dictionary(record.stories)
        || Object.entries(record.stories).some(([key, item]) => !/^[A-Za-z0-9_-]+$/.test(key) || !dictionary(item))) {
        throw Object.assign(new Error('Invalid user document'), { code: 'user_document_invalid' });
    }
    return cloneJsonValue(record) as UserDocument;
}

export function sameUserDocument(left: UserDocument | null, right: UserDocument | null): boolean {
    return left === null || right === null ? left === right : left.commitId === right.commitId && left.revision === right.revision;
}
