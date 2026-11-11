import { extensionFolderPath } from '../core/constants.js';

// The bundled docs viewer; page names are docs/user/<page>.md and anchors are heading slugs.
export function docsUrl(page = 'index', anchor = '') {
    const search = page === 'index' ? '' : `?page=${encodeURIComponent(page)}`;
    return `/${extensionFolderPath}/docs/index.html${search}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`;
}
