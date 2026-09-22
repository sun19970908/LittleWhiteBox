// Existing administrator v1 files are converted only at the read boundary. No v1 runtime path.
// Remove this reader when support for importing these files is explicitly dropped.
interface V1Operation { id: string; appId: string; name: string; target: string; status: string; elapsedMs: number; summary: string }
interface V1Turn {
    id: string; createdAt: number; user: { text: string; image?: { name: string; path: string } } | null;
    assistant: string | null; operations: V1Operation[]; status: string; error: string;
}
interface V1Data { schemaVersion: 1; revision: number; turns: V1Turn[]; summary: { text: string; throughId: string } | null }
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new Error('administrator_data_invalid'); }
    return value as Record<string, unknown>;
}
function readV1(value: unknown): V1Data {
    const data = record(value);
    if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.revision) || Number(data.revision) < 0 || !Array.isArray(data.turns)) { throw new Error('administrator_data_invalid'); }
    const ids = new Set<string>();
    for (const raw of data.turns) {
        const turn = record(raw);
        if (typeof turn.id !== 'string' || !turn.id || ids.has(turn.id) || !Number.isFinite(turn.createdAt)
            || !['finished', 'interrupted', 'failed'].includes(String(turn.status)) || typeof turn.error !== 'string'
            || turn.assistant !== null && typeof turn.assistant !== 'string' || !Array.isArray(turn.operations)) { throw new Error('administrator_data_invalid'); }
        ids.add(turn.id);
        if (turn.user !== null) {
            const user = record(turn.user);
            if (typeof user.text !== 'string') { throw new Error('administrator_data_invalid'); }
            if (user.image !== undefined) {
                const image = record(user.image);
                if (typeof image.name !== 'string' || typeof image.path !== 'string' || !/^\/user\/images\/xb-os-admin-[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(png|jpeg|webp|gif)$/u.test(image.path)) { throw new Error('administrator_data_invalid'); }
            }
        }
        for (const item of turn.operations) {
            const op = record(item);
            if (['id', 'appId', 'name', 'target', 'summary'].some(key => typeof op[key] !== 'string') || !Number.isFinite(op.elapsedMs)
                || !['preparing', 'reading', 'saving', 'read', 'saved', 'unchanged', 'partial', 'failed', 'unconfirmed'].includes(String(op.status))) { throw new Error('administrator_data_invalid'); }
        }
    }
    if (data.summary !== null) {
        const summary = record(data.summary);
        if (typeof summary.text !== 'string' || typeof summary.throughId !== 'string' || !ids.has(summary.throughId)) { throw new Error('administrator_data_invalid'); }
    }
    return structuredClone(data) as unknown as V1Data;
}
export function convertAdministratorV1(value: unknown): unknown {
    const data = readV1(value);
    return { schemaVersion: 2, revision: data.revision, turns: data.turns.map(turn => ({ ...turn, toolMessages: [] })),
        summary: data.summary ? { ...data.summary, throughToolMessage: null } : null };
}
