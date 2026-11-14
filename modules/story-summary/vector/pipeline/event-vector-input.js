import { inputDigest } from '../utils/vector-input-digest.js';
import { matchesVectorSource } from '../utils/vector-source.js';

export function buildEventVectorText(event) {
    return `${event?.title || ''} ${event?.summary || ''}`.trim();
}

export function selectMissingEventVectorPairs(events, vectors, fingerprint) {
    const byId = new Map(vectors.map(item => [item.eventId, item]));
    return (events || []).filter(event => {
        const vector = byId.get(event?.id);
        return event?.id && (!vector || vector.fingerprint !== fingerprint
            || !matchesVectorSource(vector, { sourceHash: inputDigest('event', buildEventVectorText(event)) }));
    })
        .map(event => ({ id: event.id, text: buildEventVectorText(event) })).filter(pair => pair.text);
}
