export const LOOKUP_SCOPE_PROJECT = 'project';
export const LOOKUP_SCOPE_LOCAL = 'local';
export const LOOKUP_SCOPES = Object.freeze([LOOKUP_SCOPE_PROJECT, LOOKUP_SCOPE_LOCAL]);
export const INVALID_LOOKUP_SCOPE = 'invalid_lookup_scope';

export function describeInvalidLookupScope(rawScope) {
    const received = rawScope === undefined ? '' : `收到的 scope 是 ${JSON.stringify(rawScope)}。`;
    return `${received}scope 选择文件来源：${LOOKUP_SCOPE_PROJECT} 是项目源码，${LOOKUP_SCOPE_LOCAL} 是 local/ 工作区。目录或文件路径放在 path（Read 使用 filePath）中，读取或搜索卡文件时使用 scope: "${LOOKUP_SCOPE_LOCAL}"，并保留路径的 local/ 前缀。`;
}

export function normalizeLookupScope(rawScope = '') {
    const normalized = String(rawScope || '').trim().toLowerCase();
    if (!normalized) return LOOKUP_SCOPE_PROJECT;
    if (LOOKUP_SCOPES.includes(normalized)) return normalized;
    throw new Error(INVALID_LOOKUP_SCOPE);
}

export function isLocalLookupTarget(rawPath = '') {
    const normalized = String(rawPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    return normalized === 'local' || normalized.startsWith('local/');
}

export function filterLookupFilesByPath(files = [], rawPath = '') {
    const normalizedPath = String(rawPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedPath) return files;

    const exactFile = files.filter((entry) => String(entry?.publicPath || '') === normalizedPath);
    if (exactFile.length) return exactFile;

    const directoryPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
    return files.filter((entry) => String(entry?.publicPath || '').startsWith(directoryPath));
}

export function assertLookupScopePath(rawPath = '', scope = LOOKUP_SCOPE_PROJECT) {
    const normalized = String(rawPath || '').trim();
    if (!normalized) return;
    if (isLocalLookupTarget(normalized)) {
        if (scope !== LOOKUP_SCOPE_LOCAL) {
            throw new Error('workspace_scope_local_required');
        }
        return;
    }
    if (scope === LOOKUP_SCOPE_LOCAL) {
        throw new Error('workspace_scope_local_only');
    }
}

export function assertLookupScopePattern(rawPattern = '', scope = LOOKUP_SCOPE_PROJECT) {
    const normalized = String(rawPattern || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) return;
    if (normalized === 'local' || normalized.startsWith('local/')) {
        if (scope !== LOOKUP_SCOPE_LOCAL) {
            throw new Error('workspace_scope_local_required');
        }
        return;
    }
    if (scope === LOOKUP_SCOPE_LOCAL && normalized.startsWith('scripts/')) {
        throw new Error('workspace_scope_local_only');
    }
}
