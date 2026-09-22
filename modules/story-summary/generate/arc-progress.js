// Model I/O uses a whole-number score; the store and UI keep their existing ratio.
export const ARC_PROGRESS_MAX = 100;

export function parseModelArcProgress(value) {
    let number = value;
    if (typeof value === 'string') {
        // Model/API compatibility: decimal text may carry a percent suffix.
        // Retain while accepting model-generated responses; stored progress is canonical.
        const match = value.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%?$/u);
        if (!match) return null;
        number = Number(match[1]);
    }
    if (typeof number !== 'number' || !Number.isFinite(number)) return null;
    return Math.trunc(Math.max(0, Math.min(ARC_PROGRESS_MAX, number))) / ARC_PROGRESS_MAX;
}

export function formatModelArcProgress(ratio) {
    // Stored hundredths must survive binary floating-point multiplication (e.g. .29).
    return Math.round(ratio * ARC_PROGRESS_MAX);
}
