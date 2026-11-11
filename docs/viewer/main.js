import MarkdownIt from 'markdown-it';
import { DOMPurify } from '../../../../../../lib.js';
import { HOME_PAGE, NAV_PAGE, headingSlug, pageFromSearch, sourceUrl, viewerHref } from './routes.js';
import { DOCS_COPY } from './copy.js';
import './docs.css';

const markdown = new MarkdownIt({ html: true, linkify: true });
const nav = document.querySelector('.docs-nav');
const article = document.querySelector('.docs-article');

async function readPage(page) {
    const response = await fetch(sourceUrl(page), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${sourceUrl(page)}: ${response.status}`);
    return response.text();
}

function renderInto(target, source) {
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(markdown.render(source));
    for (const link of template.content.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        const local = viewerHref(href);
        if (local) link.setAttribute('href', local);
        else if (/^https?:/.test(href)) Object.assign(link, { target: '_blank', rel: 'noopener noreferrer' });
    }
    for (const heading of template.content.querySelectorAll('h1, h2, h3, h4')) heading.id = headingSlug(heading.textContent);
    target.replaceChildren(template.content);
}

function showFailure(target, message) {
    const notice = document.createElement('p');
    notice.className = 'docs-state';
    notice.setAttribute('role', 'alert');
    notice.textContent = message;
    target.replaceChildren(notice);
}

function markCurrent(page) {
    for (const link of nav.querySelectorAll('a[href]')) {
        const target = new URL(link.href);
        const current = target.pathname === location.pathname && (pageFromSearch(target.search) === page) && !target.hash;
        if (current) link.setAttribute('aria-current', 'page');
    }
}

async function start() {
    const page = pageFromSearch(location.search);
    const [navResult, pageResult] = await Promise.allSettled([
        readPage(NAV_PAGE),
        page ? readPage(page) : Promise.reject(new Error(`Invalid page: ${location.search}`)),
    ]);
    if (navResult.status === 'fulfilled') renderInto(nav, navResult.value);
    else console.error(navResult.reason);
    if (pageResult.status === 'rejected') {
        console.error(pageResult.reason);
        showFailure(article, page && page !== HOME_PAGE ? DOCS_COPY.missingPage : DOCS_COPY.loadFailed);
        return;
    }
    renderInto(article, pageResult.value);
    const heading = article.querySelector('h1')?.textContent;
    document.title = heading && heading !== DOCS_COPY.title ? `${heading} · ${DOCS_COPY.title}` : DOCS_COPY.title;
    markCurrent(page);
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

start().catch(error => {
    console.error(error);
    showFailure(article, DOCS_COPY.loadFailed);
});
