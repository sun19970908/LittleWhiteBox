import { parseLearningVoice, learningSpeechParts } from '../../../domains/learning/speech.js';
import { requireLearning } from '../../../domains/learning/validation.js';
import { canReadLearningScope } from '../../../domains/learning/types.js';
import { createLearningMedia, type LearningSpeech, type LearningTtsFacade, type LearningMediaState } from '../host/media-adapter.js';
import { confirmedLearning, createLearningService, type LearningRepository } from './service.js';
import type { LearningClassroom } from './teaching.js';

/** Saved listening basis plus transport. Playback objects and in-flight events stay in this classroom. */
export function createLearningSpeech(options: {
    repository: LearningRepository; current(): LearningClassroom | null;
    getFacade?: () => LearningTtsFacade | undefined; onState(state: LearningMediaState): void;
    onSave(): void; onError(error?: unknown): void;
}) {
    const service = createLearningService(options.repository);
    let pending: Promise<boolean> = Promise.resolve(true);
    const hearingWrites: Array<() => Promise<void>> = [];
    let blocked = false;
    let revision = 0;
    let listening: { classroom: LearningClassroom; unitId: string; exerciseId: string; materialId: string; request: LearningSpeech } | null = null;
    const media = createLearningMedia({ getFacade: options.getFacade, isCurrent: () => !!options.current(), onState: options.onState,
        onPlayback(request, event) {
            const owner = listening;
            if (!owner || owner.request.key !== request.key) { return; }
            const guard = () => JSON.stringify(options.current()) === JSON.stringify(owner.classroom);
            hearingWrites.push(async () => {
                if (!guard()) { return; }
                // Adoption can replace the lesson while later playback events are still queued.
                // Only retry a fact while its original exercise and exact spoken span still exist.
                const unit = confirmedLearning(options.repository)?.data.profiles.find(entry => entry.language === owner.classroom.language)?.unit;
                const exercise = unit?.exercises.find(entry => entry.id === owner.exerciseId);
                const material = unit?.materials.find(entry => entry.id === owner.materialId);
                if (unit?.id !== owner.unitId || !exercise || exercise.skill !== 'listening'
                    || !canReadLearningScope(unit.scope, owner.classroom.osId)
                    || !exercise.materialIds.includes(owner.materialId) || !material
                    || !learningSpeechParts(material).some(part => part.key === request.key && part.text === request.text)) { return; }
                const result = await service.listening(owner.classroom.language, owner.unitId, owner.exerciseId,
                    { voiceId: request.voiceId, language: request.language, speed: request.speed },
                    request.key, event.started, event.slow, owner.classroom.osId, guard);
                // An uncertain candidate belongs to repository recovery; never increment it twice.
                if (result.status !== 'confirmed' && result.status !== 'unchanged') { options.onError(); media.stop(); }
                options.onSave();
            });
            pending = pending.then(() => blocked ? false : drain());
        },
    });
    async function drain(): Promise<boolean> {
        while (hearingWrites.length) {
            // Let verification/adoption run before retrying any later hearing event.
            if (options.repository.snapshot().status !== 'ready') { return true; }
            try {
                await hearingWrites[0]();
                hearingWrites.shift();
            } catch (error) {
                // Definite rejection/read failure: retain the actual event for an explicit retry.
                blocked = true; options.onError(error); media.stop(); return false;
            }
        }
        blocked = false;
        return true;
    }
    function flush() { pending = pending.then(drain); return pending; }
    function stop() { revision++; listening = null; media.stop(); }
    return {
        media, stop, flush,
        // Cleanup waits for already-started writes, but need not retry an event that cannot fit.
        async settle() { await pending; },
        async play(input: { materialId: string; partKey: string; exerciseId?: string }) {
            stop();
            const own = revision;
            if (!await flush()) { return; }
            if (own !== revision) { return; }
            const classroom = structuredClone(options.current());
            requireLearning(classroom, 'classroom', 'Choose a teacher and language');
            const guard = () => own === revision && JSON.stringify(options.current()) === JSON.stringify(classroom);
            const profile = confirmedLearning(options.repository)?.data.profiles.find(entry => entry.language === classroom.language);
            const unit = profile?.unit;
            requireLearning(unit && (unit.scope.kind === 'public' || unit.scope.osId === classroom.osId), 'unit', 'Select an available lesson');
            const material = unit.materials.find(entry => entry.id === input.materialId);
            const part = material && learningSpeechParts(material).find(entry => entry.key === input.partKey);
            requireLearning(material && part, 'material', 'Select an actual material span');
            const exercise = unit.exercises.find(entry => entry.id === input.exerciseId);
            const isListening = exercise?.skill === 'listening' && exercise.materialIds.includes(material.id);
            requireLearning(isListening || material.transcriptRevealed
                || !unit.exercises.some(entry => entry.skill === 'listening' && entry.materialIds.includes(material.id)), 'material', 'Reveal the transcript before reading it outside this exercise');
            const capability = media.capabilities();
            if (!capability.enabled) {
                await media.play({ key: part.key, text: '', voiceId: '', language: classroom.language, speed: 1 }); return;
            }
            const locked = isListening && unit.listening?.find(entry => entry.parts.some(heard => heard.key === part.key))?.voice;
            const voice = parseLearningVoice(locked || profile?.voice || { voiceId: capability.defaultVoice, language: classroom.language, speed: 1 });
            if (!capability.voices.some(entry => entry.id === voice.voiceId && entry.available)) {
                await media.play({ ...voice, key: part.key, text: '' }); return;
            }
            if (!guard()) { return; }
            const request = { ...voice, key: part.key, text: part.text };
            if (isListening) { listening = { classroom, unitId: unit.id, exerciseId: exercise.id, materialId: material.id, request }; }
            await media.play(request);
        },
        async say(text: string) {
            stop(); const own = revision; if (!await flush()) { return; }
            if (own !== revision) { return; }
            const classroom = options.current();
            if (!classroom) { return; }
            const profile = confirmedLearning(options.repository)?.data.profiles.find(entry => entry.language === classroom.language);
            const voice = profile?.voice ?? { voiceId: media.capabilities().defaultVoice, language: classroom.language, speed: 1 };
            // Short, explicitly selected text only; long materials use deterministic part controls.
            requireLearning(text.length > 0 && [...text].length <= 1000, 'text', 'Choose up to 1000 characters to read');
            await media.play({ ...voice, key: 'selection', text });
        },
    };
}
