import { projectionMarker, type ChatMessage } from './projection.js';

/**
 * Conservative without a loaded sidecar: a marked tail may still grow after
 * reopening. Ordinary story seals it by moving it out of the tail.
 */
export function privateMessagesStableEnd(messages: readonly ChatMessage[]): number {
    const end = messages.length - 1;
    return projectionMarker(messages[end]) ? end - 1 : end;
}
