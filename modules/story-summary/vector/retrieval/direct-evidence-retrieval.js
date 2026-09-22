import { selectRecallRuntimeL1Evidence } from '../runtime/runtime.js';

export async function selectDirectEvidence(context, options = {}) {
    if (!context?.runtimeLease || !context?.chatId) {
        return { items: [], status: 'skipped', stats: {} };
    }
    return await selectRecallRuntimeL1Evidence(context.chatId, context.sourceEvents, {
        sourceTurns: context.sourceTurns,
        hiddenThrough: options.hiddenThrough,
        queryVector: context.queryVector,
        lexicalScores: context.lexicalScores,
        temporalCarrier: context.temporalCarrier,
        signal: context.signal,
    });
}
