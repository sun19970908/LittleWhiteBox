import { configureStorySummaryRuntime, mountStorySummaryButton } from '../../../../modules/story-summary/story-summary.js';
import { STORY_SUMMARY_TOGGLE_EVENT } from '../../../../modules/story-summary/runtime-events.js';
import { createStorySummaryMessageDecorator } from './message-buttons.js';
import { getStorySummaryRuntimeOptions } from './runtime-options.js';

export function configureTauriTavernStorySummary(environment) {
    configureStorySummaryRuntime(getStorySummaryRuntimeOptions(environment));
}

export function createTauriTavernStorySummaryDecorator(settings) {
    return createStorySummaryMessageDecorator({
        isEnabled: () => settings.enabled && settings.storySummary?.enabled,
        mountButton: mountStorySummaryButton,
        subscribeToggle(listener) {
            $(document).on(STORY_SUMMARY_TOGGLE_EVENT, listener);
            return () => $(document).off(STORY_SUMMARY_TOGGLE_EVENT, listener);
        },
    });
}
