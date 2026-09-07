const MAX_TRACKED_RUNS = 100;
const CONSOLE_PREFIX = '[Draw Run][Scene Planner] Tool 返回未通过校验';
const loggedFailureSignatures = new Map();

function failureSignature(failure = {}) {
    return [
        Number(failure.attempt) || 0,
        String(failure.errorCode || ''),
        String(failure.errorPath || ''),
        String(failure.modelOutput || ''),
    ].join('\0');
}

function seenFailuresForRun(runId) {
    let signatures = loggedFailureSignatures.get(runId);
    if (!signatures) {
        signatures = new Set();
        loggedFailureSignatures.set(runId, signatures);
        if (loggedFailureSignatures.size > MAX_TRACKED_RUNS) {
            loggedFailureSignatures.delete(loggedFailureSignatures.keys().next().value);
        }
    }
    return signatures;
}

function parseModelOutput(value) {
    const text = String(value || '');
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function buildPlannerFailureDetails(runId, failure) {
    return {
        event: 'scene_planner_tool_validation_failed',
        runId,
        attempt: Number(failure.attempt) || 0,
        errorCode: String(failure.errorCode || ''),
        errorMessage: String(failure.errorMessage || ''),
        errorPath: String(failure.errorPath || ''),
        errorRule: String(failure.errorRule || ''),
        received: failure.received,
        expected: failure.expected,
        llmResult: parseModelOutput(failure.modelOutput),
        llmResultTruncated: failure.modelOutputTruncated === true,
    };
}

export function logDrawRunPlannerFailures(run, logger = console) {
    if (!run?.id || !Array.isArray(run?.progress?.validationFailures)) return 0;
    const runId = String(run.id);
    const seen = seenFailuresForRun(runId);
    let logged = 0;
    for (const failure of run.progress.validationFailures) {
        if (!failure || typeof failure !== 'object') continue;
        const signature = failureSignature(failure);
        if (seen.has(signature)) continue;
        try {
            logger.warn(CONSOLE_PREFIX, buildPlannerFailureDetails(runId, failure));
            seen.add(signature);
            logged += 1;
        } catch {
            // Browser logging must never affect Draw Run recovery.
        }
    }
    return logged;
}

export function resetDrawRunPlannerFailureLogsForTests() {
    loggedFailureSignatures.clear();
}
