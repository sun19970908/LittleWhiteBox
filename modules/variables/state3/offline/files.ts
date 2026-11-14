import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CARD_EXTENSION, DEFINITION_FILE, FUNCTION_DIRECTORY, TOOL_DIRECTORY, SCRIPT_DIRECTORY } from '../definition/format.js';
import { decodeBundle, locateVariableFile, projectVariableFiles, variableBundleFromFiles, type CardFile } from '../definition/card-files.js';
import type { Bundle, JsonObject } from '../types.js';
import { cardData, readCard, writeCard } from './card.js';
import { OFFLINE_COPY as C } from './copy.js';

export const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));
export async function readBundle(source: string): Promise<Bundle> {
    if ((await stat(source)).isDirectory()) {
        const files: CardFile[] = [{ path: DEFINITION_FILE, content: await readFile(path.join(source, DEFINITION_FILE), 'utf8') }];
        for (const directory of [FUNCTION_DIRECTORY, TOOL_DIRECTORY, SCRIPT_DIRECTORY]) {
            let entries;
            try {entries = await readdir(path.join(source, directory), { withFileTypes: true });}
            catch (error) {if ((error as NodeJS.ErrnoException).code === 'ENOENT') {continue;} throw error;}
            for (const entry of entries) {
                const relative = directory + entry.name;
                if (!entry.isFile() || !locateVariableFile(relative)) {throw new Error(`${C.file} ${relative}`);}
                files.push({ path: relative, content: await readFile(path.join(source, relative), 'utf8') });
            }
        }
        return variableBundleFromFiles('', files);
    }
    const bytes = await readFile(source), extension = path.extname(source).toLowerCase();
    const value: unknown = extension === '.png' ? readCard(bytes, extension) : JSON.parse(bytes.toString('utf8'));
    if (value && typeof value === 'object' && 'spec' in value) {
        return decodeBundle((cardData(value).extensions as JsonObject | undefined)?.[CARD_EXTENSION]);
    }
    return decodeBundle(value);
}

export async function writeNewFile(file: string, bytes: string | Buffer) {
    try {await writeFile(file, bytes, { flag: 'wx' });}
    catch (error) {if ((error as NodeJS.ErrnoException).code === 'EEXIST') {throw new Error(C.exists);} throw error;}
}
export async function writeDirectory(directory: string, bundle: Bundle, card?: JsonObject) {
    const files = projectVariableFiles('', bundle);
    if (card) {files.push({ path: 'card.json', content: JSON.stringify(card, null, 2) + '\n' });}
    // Creating the owned output root exclusively prevents replacing an author's draft.
    try {await mkdir(directory);}
    catch (error) {if ((error as NodeJS.ErrnoException).code === 'EEXIST') {throw new Error(C.exists);} throw error;}
    try {
        for (const file of files) {
            const destination = path.join(directory, file.path);
            await mkdir(path.dirname(destination), { recursive: true });
            await writeNewFile(destination, file.content);
        }
    } catch (error) {await rm(directory, { recursive: true }); throw error;}
}
export async function packCard(source: string, output: string, bundle: Bundle) {
    const extension = path.extname(source).toLowerCase();
    if (path.extname(output).toLowerCase() !== extension || !['.json', '.png'].includes(extension)) {throw new Error(C.output);}
    await writeNewFile(output, writeCard(await readFile(source), extension, bundle));
}
