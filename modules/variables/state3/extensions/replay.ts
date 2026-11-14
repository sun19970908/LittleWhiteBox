import { clone } from '../engine/data.js';
import type { ExtensionTrace, Json } from '../types.js';
import type { ExtensionTest } from './testing.js';

export function replayExtension(trace: ExtensionTrace): ExtensionTest {
    const input = trace.kind === 'calculate' ? trace.input as { submission: Json; prepared: Json } : undefined;
    return { ...clone(trace.context), kind: trace.kind, name: trace.name,
        input: input ? input.submission : clone(trace.input), ...(input ? { prepared: input.prepared } : {}) };
}
