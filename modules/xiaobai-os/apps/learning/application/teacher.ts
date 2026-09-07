import { parseTeacherPreference, type LearningTeacherPreference } from '../../../domains/learning/profile.js';
import { selectKnownPeople, type KnownPerson } from '../../../host/prompt-context/known-people.js';
import type { ScopedChatStore } from '../../../kernel/contracts.js';

export function createLearningTeacherService(store: ScopedChatStore<LearningTeacherPreference>, sources: {
    knownPeople(): KnownPerson[];
    playerName(): string;
}) {
    return Object.freeze({
        candidates: () => selectKnownPeople(sources.knownPeople(), sources.playerName()),
        read: () => store.read(),
        select(identityKey: string, teacher: LearningTeacherPreference['teacher'], isCurrent: () => boolean) {
            const preference = parseTeacherPreference({ teacher });
            const key = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase();
            const player = key(sources.playerName());
            const playerNames = [player, ...sources.knownPeople().filter(person => [person.name, ...person.aliases].some(name => key(name) === player))
                .flatMap(person => [person.name, ...person.aliases].map(key))];
            if (preference.teacher && playerNames.includes(key(preference.teacher.name))) { throw new Error('learning_teacher_is_player'); }
            const valid = () => !!identityKey && isCurrent() && store.peekCurrent()?.identityKey === identityKey;
            return store.transact(transaction => {
                if (!valid()) { throw new Error('learning_context_changed'); }
                const current = transaction.currentOrInitial();
                if (JSON.stringify(current) !== JSON.stringify(preference)) { transaction.replace(preference); }
            }, { commitGuard: valid });
        },
    });
}
