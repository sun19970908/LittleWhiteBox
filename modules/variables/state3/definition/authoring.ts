import type { Result, RunOptions } from '../types.js';
export interface Draft { root: string; avatar: string; name: string; files: CardFile[] }
import { runCardFiles } from '../../../card-workspace/service.js';
import { currentCard, readCharacter } from '../../../card-workspace/host.js';
import { readFiles } from '../../../card-workspace/workspace.js';
import { workspaceRepository } from '../../../assistant/shared/workspace-repository.js';
import { upsertLocalSourceFile } from '../../../assistant/shared/local-workspace-kernel.js';
import { buildWorkspacePreconditions } from '../../../assistant/shared/workspace-preconditions.js';
import { INTERNAL_WORKSPACE_TOOL_NAMES } from '../../../assistant/shared/workspace-protocol.js';
import { CARD_EXTENSION, DEFINITION_FILE } from './format.js';
import { variableBundleFromFiles, decodeBundle, type CardFile } from './card-files.js';
import { compileDefinition } from './compile.js';
import { initialize, settle } from '../engine/settle.js';
import { diagnostic, reject } from '../engine/diagnostics.js';

export async function openDraft() {
    const opened = await runCardFiles({ action: 'open' });
    if (!('root' in opened)) {reject('definition-missing');}
    const files = (await readFiles()).filter(file => file.path?.startsWith(`${opened.root}variables/`));
    return { ...opened, files } as Draft;
}

export async function saveDraft(draft: Draft, updates: CardFile[]) {
    if (currentCard().avatar !== draft.avatar) {reject('stale-target');}
    const args = { files: updates };
    const sources = (await workspaceRepository.readWorkspace()).localSources;
    const observed = buildWorkspacePreconditions(INTERNAL_WORKSPACE_TOOL_NAMES.BATCH_WRITE_FILES, args, sources);
    // The editor's observed contents, not a fresh read, protect assistant edits
    // made while this page was open. Imports/save receipts alone advance baseline.
    for (const file of updates) {
        const current = (await readFiles()).find(item => item.path === file.path);
        const original = draft.files.find(item => item.path === file.path);
        if ((current?.content ?? null) !== (original?.content ?? null)) {reject('draft-conflict', { path: file.path });}
    }
    const result = await workspaceRepository.commitWorkspaceMutation({
        name: INTERNAL_WORKSPACE_TOOL_NAMES.BATCH_WRITE_FILES, args, preconditions: observed,
        signal: undefined, retryContent: undefined,
        execute: async (sources: Awaited<ReturnType<typeof workspaceRepository.readWorkspace>>['localSources']) => {
            let nextSources: Parameters<typeof upsertLocalSourceFile>[0] = sources;
            for (const file of updates) {nextSources = upsertLocalSourceFile(nextSources, file.path, file.content).nextSources;}
            return { result: { ok: true }, nextSources };
        },
    });
    if (!result.committed) {reject('draft-conflict');}
    return openDraft();
}

export function draftBundle(draft: Draft) { return variableBundleFromFiles(draft.root, draft.files); }
export async function checkDraft(draft: Draft, input: unknown = [], { signal }: RunOptions = {}): Promise<Result> {
    try {
        const compiled = compileDefinition(draftBundle(draft));
        const initial = await initialize(compiled, { signal });
        if (!initial.ok) {return initial;}
        return settle(compiled, initial.state, input, { signal });
    } catch (error) {return { ok: false, diagnostics: [diagnostic(error)] };}
}
export async function saveCardDraft(draft: Draft) {
    if (currentCard().avatar !== draft.avatar) {reject('stale-target');}
    return runCardFiles({ action: 'save', paths: [draft.root + DEFINITION_FILE] });
}
export async function readCardBundle(signal?: AbortSignal) {
    const selected = currentCard();
    const card = await readCharacter(selected.avatar, signal);
    if (currentCard().avatar !== selected.avatar) {reject('stale-target');}
    const bundle = card.data.extensions?.[CARD_EXTENSION];
    if (!bundle) {reject('definition-missing');}
    return decodeBundle(bundle);
}
