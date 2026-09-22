import { mountHistoryButton } from '../../modules/message-preview.js';
import { mountVariablesButton } from '../../modules/variables/variables-panel.js';
import { createButtonCollapseCleanup } from '../../widgets/button-collapse.js';
import { mountMessageDecorators } from './chat-surface/decorator-lifecycle.js';
import { createTauriTavernStorySummaryDecorator } from './features/story-summary/index.js';
import { TAURITAVERN_MESSAGES } from './diagnostics.js';
import { mountTauriTavernDrawPanel } from './features/draw/index.js';
import { mountStoryOutlineButton } from '../../modules/story-outline/story-outline.js';
import { mountTtsMessagePanel } from '../../modules/tts/tts.js';

export function createTauriTavernMessageDecorator({ settings, hasCustomTemplateForMessage }) {
    const mountSummary = createTauriTavernStorySummaryDecorator(settings);
    const residents = new Set();
    function mount({ element, mesid }) {
        let release;
        function reconcile() {
            release?.();
            release = undefined;
            if (settings.enabled) {
                if (hasCustomTemplateForMessage(mesid)) {
                    throw new Error(TAURITAVERN_MESSAGES.customTemplateUnsupported);
                }
                release = mountMessageDecorators({
                    element,
                    mesid,
                    createContainerCleanup: createButtonCollapseCleanup,
                    decorators: [mountHistoryButton, mountVariablesButton, mountSummary, mountStoryOutlineButton, mountTauriTavernDrawPanel, mountTtsMessagePanel],
                });
            }
        }
        reconcile();
        residents.add(reconcile);
        return () => {
            residents.delete(reconcile);
            release?.();
            release = undefined;
        };
    }
    return { mount, refresh: () => residents.forEach(reconcile => reconcile()) };
}
