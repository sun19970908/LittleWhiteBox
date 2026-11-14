import path from 'node:path';

// DevTools uses ignoreList to select the first real caller for console links.
// Map only the isolated forwarding chunk, never a chunk containing business code.
export function createConsoleForwardPlugin({ root }) {
    const forwardModule = path.resolve(root, 'core/console-forward.js').replaceAll('\\', '/');
    return {
        name: 'console-forward-source',
        config() {
            return { build: { rollupOptions: { output: { codeSplitting: { groups: [
                { name: 'console-forward', test: id => id.replaceAll('\\', '/') === forwardModule },
            ] } } } } };
        },
        renderChunk: { order: 'post', handler(code, chunk) {
            const modules = Object.keys(chunk.modules);
            if (!modules.includes(forwardModule)) return null;
            if (modules.length !== 1) throw new Error('Console forwarding must be isolated from business code.');
            // This map describes the generated forwarding code itself, line for line.
            const map = {
                version: 3,
                sources: ['console-forward.generated.js'],
                sourcesContent: [code],
                names: [],
                mappings: code.split('\n').map((_, index) => index ? 'AACA' : 'AAAA').join(';'),
                ignoreList: [0],
                x_google_ignoreList: [0],
            };
            return { code: code + '\n//# sourceMappingURL=data:application/json;base64,' + Buffer.from(JSON.stringify(map)).toString('base64') + '\n', map: null };
        } },
    };
}
