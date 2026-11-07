import { currentCard, linkedBooks, readCharacter, readBook, readTarget, refreshVariableFiles, saveFile } from './host.js';
import { readFiles, storeFiles, observePaths } from './workspace.js';
import { cardFiles, locateFile, rootFor } from './files.js';
import { COPY } from './copy.js';
import { variableFileGroup, variableGroupChanged } from '../variables/state3/definition/card-files.js';

// Only live writeback operations serialize here. Editor text stays in the
// Assistant workspace, not in this run-local queue.
let writes = Promise.resolve();

export async function runCardFiles(args, options = {}) {
    if (args.action === 'open') return openFiles(options.signal);
    if (args.action === 'refresh') return refreshFiles(args.paths, options.signal);
    if (args.action !== 'save') throw new Error(COPY.unsupported);
    const work = writes.then(() => saveFiles(args.paths, options.signal));
    writes = work.catch(error => console.warn({ source: import.meta.url, operation: 'cardWriteback' }, error));
    return work;
}

async function openFiles(signal) {
    const selected = currentCard(), avatar = selected.avatar, root = rootFor(avatar);
    const present = (await readFiles()).filter(file => file.path.startsWith(root));
    if (present.length) return { root, avatar, name: selected.name, paths: present.map(file => file.path), reused: true };
    const card = await readCharacter(avatar, signal), books = [];
    for (const name of linkedBooks(card)) {
        const book = await readBook(name, signal);
        if (book) books.push([name, book]);
    }
    const files = cardFiles(avatar, card.data, books);
    const observed = await observePaths(files.map(file => file.path));
    // Opening while another tool has already populated the directory must not
    // replace that tool's work. The transaction handles edits after this check.
    const latest = (await readFiles()).filter(file => file.path.startsWith(root));
    if (latest.length) return { root, avatar, name: selected.name, paths: latest.map(file => file.path), reused: true };
    await storeFiles(files, { observed });
    return { root, avatar, name: selected.name, paths: files.map(file => file.path), reused: false };
}

function selectedPaths(paths) {
    if (!Array.isArray(paths) || !paths.length) throw new Error(COPY.noFiles);
    return [...new Set(paths)];
}

async function refreshFiles(paths, signal) {
    const requested = selectedPaths(paths), observed = await observePaths(requested), files = [], roots = new Set();
    for (const path of requested) {
        const target = locateFile(path);
        if (!target) throw new Error(COPY.unsupported);
        if (target.kind === 'variables') {
            if (roots.has(target.root)) continue;
            roots.add(target.root);
            await refreshVariableFiles(target, signal);
            continue;
        }
        const content = await readTarget(target, signal);
        if (content === null) throw new Error(`${COPY.missing}: ${path}`);
        files.push({ path, content });
    }
    if (files.length) await storeFiles(files, { observed });
    return { paths: requested, refreshed: true };
}

async function saveFiles(paths, signal) {
    const files = await readFiles(), groups = new Map(), results = [];
    for (const path of selectedPaths(paths)) {
        const file = files.find(item => item.path === path), target = locateFile(path);
        if (!file || !target) { results.push({ path, saved: false, error: !file ? COPY.missing : COPY.unsupported }); continue; }
        if (target.kind === 'variables') {
            const key = `${target.root}variables`;
            if (!groups.has(key)) groups.set(key, variableFileGroup(target.root, files, locateFile));
            continue;
        }
        const key = ['world', 'regex', 'tasks'].includes(target.kind) ? `${target.root}${target.kind}/${target.book || ''}/${target.id}` : path;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ target, file });
    }
    for (const entries of groups.values()) {
        try {
            signal?.throwIfAborted();
            const [first, ...companions] = entries;
            const result = await saveFile(first.target, first.file, signal, companions);
            const receipts = entries.map((item, index) => ({ path: item.file.path, content: result.contents?.[index] ?? result.content,
                ...(result.originalGroupHash && item.target.settings ? { originalGroupHash: result.originalGroupHash } : {}) }));
            await storeFiles(receipts, { baselineOnly: true });
            const latest = await readFiles();
            const groupChanged = first.target.kind === 'variables' && variableGroupChanged(first.target.root, entries, latest);
            results.push(...receipts.map((item, index) => ({ path: item.path, saved: true, unchanged: result.unchanged === true,
                hasUnsavedEdits: groupChanged || latest.some(file => file.path === item.path && file.content !== entries[index].file.content) })));
        } catch (error) {
            results.push(...entries.map(item => ({ path: item.file.path, saved: false, error: error.message })));
        }
    }
    return { ok: results.every(item => item.saved), results };
}
