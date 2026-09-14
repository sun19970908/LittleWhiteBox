import { promptTemplateFingerprint } from './prompt-template-migration.js';

// Frozen openings saved with NovelAI template 13, SD WebUI 9 and ComfyUI 10.
// Used only at the settings-upgrade boundary; remove when those inputs leave support.
const PREVIOUS_OPENING_FINGERPRINTS = Object.freeze({
    topSystem: '121:beb12128:d7165256',
    topSystemPov: '685:eb26b1e0:4881b3ce',
});

/** Replace only untouched default openings, independent of preset names or other edits. */
export function updateScenePlannerPresetOpenings(presets, defaults) {
    return presets.map(preset => {
        if (typeof preset?.topSystem !== 'string') return preset;
        const fingerprint = promptTemplateFingerprint(preset.topSystem);
        const key = Object.keys(PREVIOUS_OPENING_FINGERPRINTS)
            .find(key => PREVIOUS_OPENING_FINGERPRINTS[key] === fingerprint);
        return key ? { ...preset, topSystem: defaults[key] } : preset;
    });
}
