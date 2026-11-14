import path from 'node:path';
import { spec } from 'node:test/reporters';
import { Readable } from 'node:stream';

export default async function* report(source) {
    const durations = new Map();
    async function* observe() {
        for await (const event of source) {
            if (event.type === 'test:complete' && event.data.file && !event.data.entryFile) {
                durations.set(event.data.file, event.data.details.duration_ms);
            }
            yield event;
        }
    }
    yield* Readable.from(observe()).compose(new spec());
    if (durations.size) {
        yield '\n最慢测试文件（含加载时间）：\n';
        for (const [file, ms] of [...durations].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
            yield `  ${(ms / 1000).toFixed(2)}s  ${path.relative(process.cwd(), file)}\n`;
        }
    }
}
