import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import MarkdownIt from 'markdown-it';
import { NAV_PAGE, headingSlug, pageFromSearch, viewerHref } from './routes.js';

// Acceptance: every link inside the bundled user docs opens an existing page and heading.
// A broken link strands the user mid-journey with nowhere to go next.
const folder = new URL('../user/', import.meta.url);
const markdown = new MarkdownIt({ html: true, linkify: true });
const pages = new Map(readdirSync(folder).filter(file => file.endsWith('.md')).map(file => {
    const tokens = markdown.parse(readFileSync(new URL(file, folder), 'utf8'), {});
    return [file.slice(0, -3), tokens];
}));

function headings(tokens) {
    return new Set(tokens.flatMap((token, index) => token.type === 'heading_open' ? [headingSlug(tokens[index + 1].content)] : []));
}

function links(tokens) {
    return tokens.flatMap(token => token.children || []).filter(token => token.type === 'link_open').map(token => token.attrGet('href'));
}

test('user docs links resolve to existing pages and headings', () => {
    const broken = [];
    for (const [page, tokens] of pages) {
        for (const href of links(tokens)) {
            if (/^[a-z]+:/i.test(href)) continue;
            const target = href.startsWith('#') ? `${page}.md${href}` : href;
            const viewer = viewerHref(target);
            if (!viewer) { broken.push(`${page}: ${href}`); continue; }
            const url = new URL(viewer, 'https://docs.invalid/');
            const name = pageFromSearch(url.search);
            const anchor = decodeURIComponent(url.hash.slice(1));
            if (!pages.has(name) || (anchor && !headings(pages.get(name)).has(anchor))) broken.push(`${page}: ${href}`);
        }
    }
    assert.deepEqual(broken, []);
});

test('every user doc page is reachable from the navigation', () => {
    const listed = new Set(links(pages.get(NAV_PAGE)).map(href => pageFromSearch(new URL(viewerHref(href), 'https://docs.invalid/').search)));
    assert.deepEqual([...pages.keys()].filter(page => page !== NAV_PAGE && !listed.has(page)), []);
});
