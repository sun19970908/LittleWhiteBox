import { readableCardWorkspacePath, storedCardWorkspacePath } from '../../../card-workspace/paths.js';
import type { Draft } from '../definition/authoring.js';

// The assistant's read/effect classification and runtime surface share this registry.
const METHODS = Object.freeze({
    exportRules: 'read', prepareRuleImport: 'read', importRules: 'write', tryDefinition: 'read', checkDraft: 'read', inspect: 'read', preview: 'read', previewRequest: 'read', settings: 'read',
    openDraft: 'write', saveCardDraft: 'write', enable: 'write', apply: 'write', undo: 'write',
    saveSettings: 'write', retrySave: 'write', testExtension: 'write',
});
interface Manifest {
    allowedPaths?: string[]; callablePaths?: string[]; apiSemantics?: Record<string, string>;
    namespaces?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
}
export function withExtensionJsApiManifest(manifest: Manifest = {}) {
    const paths = Object.keys(METHODS).map(name => `st.state3.${name}`);
    const unique = (values: string[]) => [...new Set(values)].sort();
    return { ...manifest,
        allowedPaths: unique([...(manifest.allowedPaths || []), 'st', 'st.state3', ...paths]),
        callablePaths: unique([...(manifest.callablePaths || []), ...paths]),
        apiSemantics: { ...manifest.apiSemantics, ...Object.fromEntries(Object.entries(METHODS).map(([name, semantic]) => [`st.state3.${name}`, semantic])) },
        namespaces: { ...manifest.namespaces, st: { ...manifest.namespaces?.st, state3: paths } },
    };
}
export function state3JsApiNamespace(api: unknown): Readonly<Record<string, (...args: unknown[]) => unknown>> {
    const source = api as Record<string, unknown> | undefined;
    return Object.freeze(Object.fromEntries(Object.keys(METHODS).filter(name => typeof source?.[name] === 'function')
        .map(name => [name, (...args: unknown[]) => callAuthoringApi(name, source![name] as (...values: unknown[]) => unknown, args)])));
}

function mapDraftPaths(draft: Draft & { paths?: string[] }, map: (path: string) => string) {
    return { ...draft, root: map(draft.root),
        ...(draft.paths ? { paths: draft.paths.map(map) } : {}),
        files: draft.files.map(file => ({ ...file, path: map(file.path) })),
    };
}

// Only the assistant namespace presents readable workspace paths. Settlement
// inputs, variable paths and the public LWB_StateV3 API are unchanged.
function callAuthoringApi(name: string, call: (...args: unknown[]) => unknown, args: unknown[]) {
    if (['checkDraft', 'saveCardDraft', 'testExtension'].includes(name)) {
        args = [...args];
        args[0] = mapDraftPaths(args[0] as Draft, storedCardWorkspacePath);
    }
    const result = call(...args);
    if (name === 'openDraft') {
        return Promise.resolve(result).then(draft => mapDraftPaths(draft as Draft, readableCardWorkspacePath));
    }
    if (name === 'saveCardDraft') {
        return Promise.resolve(result).then(value => {
            const receipt = value as { results: { path: string }[] };
            return { ...receipt, results: receipt.results.map(item => ({ ...item, path: readableCardWorkspacePath(item.path) })) };
        });
    }
    return result;
}
