import { CARD_EXTENSION } from '../definition/format.js';
import type { Bundle, JsonObject } from '../types.js';
import { OFFLINE_COPY as C } from './copy.js';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
export function cardData(value: unknown): JsonObject {
    if (!object(value) || !['chara_card_v2', 'chara_card_v3'].includes(String(value.spec)) || !object(value.data)
        || (value.data.extensions !== undefined && !object(value.data.extensions))) {throw new Error(C.card);}
    return value.data;
}

interface Chunk { type: string; data: Buffer; raw: Buffer }
function crc32(bytes: Buffer) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);}
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunks(bytes: Buffer): Chunk[] {
    if (!bytes.subarray(0, 8).equals(signature)) {throw new Error(C.png);}
    const result: Chunk[] = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const size = bytes.readUInt32BE(offset), end = offset + size + 12;
        if (end > bytes.length) {throw new Error(C.png);}
        const raw = bytes.subarray(offset, end), type = raw.toString('ascii', 4, 8);
        if (crc32(raw.subarray(4, size + 8)) !== raw.readUInt32BE(size + 8)) {throw new Error(C.png);}
        result.push({ type, data: raw.subarray(8, size + 8), raw });
        offset = end;
        if (type === 'IEND') {break;}
    }
    if (result[0]?.type !== 'IHDR' || result.at(-1)?.type !== 'IEND' || offset !== bytes.length) {throw new Error(C.png);}
    return result;
}
function keyword(chunk: Chunk) {
    return chunk.type === 'tEXt' ? chunk.data.toString('latin1', 0, chunk.data.indexOf(0)).toLowerCase() : '';
}
function metadata(chunk: Chunk): unknown {
    return JSON.parse(Buffer.from(chunk.data.subarray(chunk.data.indexOf(0) + 1).toString('ascii'), 'base64').toString('utf8'));
}
function textChunk(key: string, value: unknown) {
    const body = Buffer.from(`tEXt${key}\0${Buffer.from(JSON.stringify(value)).toString('base64')}`, 'ascii');
    const result = Buffer.alloc(body.length + 8);
    result.writeUInt32BE(body.length - 4); body.copy(result, 4);
    result.writeUInt32BE(crc32(body), result.length - 4);
    return result;
}

/** PNG metadata precedence follows SillyTavern: ccv3, then chara. */
export function readCard(bytes: Buffer, extension: string): JsonObject {
    let value: unknown;
    if (extension === '.json') {value = JSON.parse(bytes.toString('utf8'));}
    else if (extension === '.png') {
        const parts = chunks(bytes), part = parts.find(chunk => keyword(chunk) === 'ccv3') ?? parts.find(chunk => keyword(chunk) === 'chara');
        if (!part) {throw new Error(C.png);}
        value = metadata(part);
    } else {throw new Error(C.card);}
    cardData(value);
    return value as JsonObject;
}

/** Replace only the owned leaf, including both metadata copies in a PNG. */
export function writeCard(bytes: Buffer, extension: string, bundle: Bundle): Buffer {
    const update = (card: unknown) => {
        const data = cardData(card);
        data.extensions = { ...(data.extensions as JsonObject | undefined), [CARD_EXTENSION]: JSON.stringify(bundle) };
        return card;
    };
    const card = readCard(bytes, extension);
    if (extension === '.json') {return Buffer.from(JSON.stringify(update(card), null, 2) + '\n');}
    return Buffer.concat([signature, ...chunks(bytes).map(chunk => ['chara', 'ccv3'].includes(keyword(chunk))
        ? textChunk(keyword(chunk), update(metadata(chunk))) : chunk.raw)]);
}
