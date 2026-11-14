import path from 'node:path';

// Node starts one isolated process per file. Only typed dependency trees need tsx.
const typedFiles = new Set(JSON.parse(process.env.LWB_TEST_TYPESCRIPT || '[]').map(file => path.resolve(file)));
if (process.argv[1] && typedFiles.has(path.resolve(process.argv[1]))) {
    await import('tsx');
}
