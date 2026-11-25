import { generateAndParseScenePlan } from '../../shared/scene-planner.js';
import { createSceneSource, normalizeMessageSceneSourceText } from '../../shared/scene-source.js';
import { detectPresentCharacters, DEFAULT_MESSAGE_FILTER_RULES, toScenePlannerProgress } from '../../shared/draw-common.js';
import { characterLibraryFromSettings } from '../../shared/character-library.js';
import { loadSharedDrawSettings } from '../../shared/draw-settings.js';
import { WorldbookProcessor } from '../../shared/worldbook-processor.js';
import { resolveEffectiveMaxImages } from '../../shared/max-images-override.js';
import { getActiveParamsPreset } from './settings-model.js';
import { naturalPlannerOptions, adaptedDirectInput } from './planning-input.js';
import { validateMultimodalInput } from './compiler.js';

const plannerRetry = shared => ({ maxRetries: shared.plannerMaxRetries });

export async function buildPlannerOptions(provider, { message, settings, sharedSettings, signal, onStateChange,
    useWorldbook = true, stripImageMarkers = true, ...input }) {
    const shared = sharedSettings || await loadSharedDrawSettings();
    const text = stripImageMarkers ? normalizeMessageSceneSourceText(message.mes) : String(message.mes || '');
    const sceneSource = createSceneSource(text, { filterRules: shared.messageFilterRules?.length ? shared.messageFilterRules : DEFAULT_MESSAGE_FILTER_RULES });
    const presentCharacters = detectPresentCharacters(sceneSource.content, characterLibraryFromSettings(shared));
    const worldbookEntries = useWorldbook && shared.worldbooks?.enabled && shared.worldbooks.uploadedBooks?.length
        ? new WorldbookProcessor().processFromEntries({
            entries: shared.worldbooks.uploadedBooks.flatMap(book => book.entries || []),
            contextText: `${sceneSource.content} ${presentCharacters.map(character => character.name).join(' ')}`,
            keywordFilterMode: shared.worldbooks.keywordFilterMode || 'auto',
        }) : null;
    return { sceneSource, plannerOptions: {
        ...naturalPlannerOptions(provider, settings, input), sceneSource, presentCharacters, worldbookEntries,
        useWorldInfo: useWorldbook && shared.useWorldInfo,
        maxImages: resolveEffectiveMaxImages(settings, getActiveParamsPreset(settings)),
        plannerRetry: plannerRetry(shared), signal,
        onDiagnosticUpdate: diagnostic => onStateChange?.('llm', toScenePlannerProgress(diagnostic)),
    } };
}

export async function planDirectInput(provider, input, settings, { signal, onStateChange, sceneConfig,
    plan = generateAndParseScenePlan } = {}) {
    validateMultimodalInput(provider, input);
    signal?.throwIfAborted();
    const shared = await loadSharedDrawSettings();
    signal?.throwIfAborted();
    onStateChange?.('llm', toScenePlannerProgress());
    const tasks = await plan({ ...naturalPlannerOptions(provider, settings, input),
        sceneSource: createSceneSource(input.prompt), maxImages: 1, presentCharacters: [], useWorldInfo: false,
        signal, timeout: settings.timeout, plannerRetry: plannerRetry(shared),
        ...(sceneConfig ? { agentOptions: { providerConfig: sceneConfig } } : {}),
        onDiagnosticUpdate: diagnostic => onStateChange?.('llm', toScenePlannerProgress(diagnostic)),
    });
    signal?.throwIfAborted();
    return adaptedDirectInput(input, tasks);
}
