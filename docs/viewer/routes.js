// Docs live beside this viewer as docs/user/<page>.md; the address is index.html?page=<page>#<heading>.
export const HOME_PAGE = 'index';
export const NAV_PAGE = 'SUMMARY';
const PAGE_NAME = /^[a-z0-9-]+$/;

export function pageFromSearch(search) {
    const page = new URLSearchParams(search).get('page') || HOME_PAGE;
    return PAGE_NAME.test(page) ? page : null;
}

export function sourceUrl(page) {
    return `user/${page}.md`;
}

// Relative links between Markdown files become viewer addresses; everything else is left alone.
export function viewerHref(href) {
    const match = /^(?:\.\/)?([a-z0-9-]+)\.md(#.*)?$/.exec(href);
    if (!match) return null;
    const search = match[1] === HOME_PAGE ? '' : `?page=${match[1]}`;
    return `index.html${search}${match[2] || ''}`;
}

// GitHub-style heading slugs, so the same anchors work when the files are read on GitHub.
export function headingSlug(text) {
    return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}
