import type { PromptContextAdapter, PromptContextCaptureOptions } from '../../../host/prompt-context/types.js';
import type { KnownPerson } from '../../../host/prompt-context/known-people.js';
import type { LearningTeacherContext } from '../agent/context.js';

/** Host composition supplies the same story adapter used by OS conversations, not another story reader. */
export function createLearningContextAdapter(adapter: PromptContextAdapter, people: (name: string) => readonly KnownPerson[],
    captureOptions: () => PromptContextCaptureOptions = () => ({})) {
    return {
        async capture(name: string, identity: string): Promise<LearningTeacherContext> {
            if (!identity || adapter.currentChatIdentity() !== identity) { throw new Error('learning_context_changed'); }
            const result = await adapter.capture(captureOptions());
            if (result.chatIdentity !== identity || adapter.currentChatIdentity() !== identity) { throw new Error('learning_context_changed'); }
            const key = name.trim().normalize('NFKC').toLocaleLowerCase();
            const teacher = people(name).filter(person => [person.name, ...person.aliases]
                .some(alias => alias.trim().normalize('NFKC').toLocaleLowerCase() === key));
            return { snapshot: result.contextSnapshot, teacherDetails: teacher.map(person => person.text).join('\n\n') };
        },
    };
}
