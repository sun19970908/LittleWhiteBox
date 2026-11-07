import { workspaceRepository } from '../assistant/shared/workspace-repository.js';
import { flattenLocalSourceFiles, upsertLocalSourceFile, removeLocalSourcePath } from '../assistant/shared/local-workspace-kernel.js';
import { INTERNAL_WORKSPACE_TOOL_NAMES } from '../assistant/shared/workspace-protocol.js';
import { buildWorkspacePreconditions } from '../assistant/shared/workspace-preconditions.js';

export async function readFiles() {
    return flattenLocalSourceFiles((await workspaceRepository.readWorkspace()).localSources);
}

// Import uses the existing workspace transaction and conflict check. A receipt
// only advances originalContent; text typed during a server save stays intact.
/**
 * @param {{path: string, content: string, originalGroupHash?: string}[]} files
 * @param {{baselineOnly?: boolean, observed?: ReturnType<typeof buildWorkspacePreconditions> | null, scopeRoot?: string | null, removePaths?: string[]}} [options]
 */
export async function storeFiles(files, { baselineOnly = false, observed = null, scopeRoot = null, removePaths = [] } = {}) {
    const name = scopeRoot ? 'Delete' : INTERNAL_WORKSPACE_TOOL_NAMES.BATCH_WRITE_FILES;
    const args = scopeRoot ? { path: scopeRoot } : { files };
    const sources = (await workspaceRepository.readWorkspace()).localSources;
    const saved = await workspaceRepository.commitWorkspaceMutation({
        name, args,
        preconditions: observed || buildWorkspacePreconditions(name, args, sources),
        execute: async sources => {
            let nextSources = structuredClone(sources);
            for (const path of removePaths) nextSources = removeLocalSourcePath(nextSources, path).nextSources;
            for (const file of files) {
                if (!baselineOnly) nextSources = upsertLocalSourceFile(nextSources, file.path, file.content).nextSources;
                for (const source of nextSources) {
                    const target = source.files?.find(item => item.path === file.path || item.publicPath === file.path);
                    if (target) {
                        target.originalContent = file.content;
                        if (typeof file.originalGroupHash === 'string') target.originalGroupHash = file.originalGroupHash;
                    }
                }
            }
            return { result: { ok: true }, nextSources };
        },
    });
    if (!saved.committed) {
        if (baselineOnly && saved.result.error === 'workspace_conflict') return storeFiles(files, { baselineOnly });
        throw new Error(saved.result.error);
    }
    return saved.localSources;
}

export async function observeTree(path) {
    const { localSources } = await workspaceRepository.readWorkspace();
    return buildWorkspacePreconditions('Delete', { path }, localSources);
}

export async function observePaths(paths) {
    const { localSources } = await workspaceRepository.readWorkspace();
    return buildWorkspacePreconditions(INTERNAL_WORKSPACE_TOOL_NAMES.BATCH_WRITE_FILES, { files: paths.map(path => ({ path })) }, localSources);
}
