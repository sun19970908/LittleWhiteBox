import { safePromptJson } from '../../../capabilities/maintenance/prompt-safety.js';

export const ADMINISTRATOR_REFERENCE_TEXT = {
    current: 'Current chat reference material: OS observations and APP records',
    summary: 'Conversation notes: the user’s goals, agreed details and progress so far',
    operations: 'Recorded operations in this conversation',
    image: (name: string) => `[Earlier attached image: ${name}; filename only in this history excerpt]`,
    initialPage: 'This is the first page of the APP’s initial reference material. Its read tools provide the record details.',
} as const;

export function administratorReferenceMessage(data: unknown) {
    return { role: 'system' as const, content: `${ADMINISTRATOR_REFERENCE_TEXT.current}:\n${safePromptJson(data)}` };
}
