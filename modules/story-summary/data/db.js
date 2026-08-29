// Memory Database (Dexie schema)

import Dexie from '../../../libs/dexie.mjs';

const DB_NAME = 'LittleWhiteBox_Memory';
const DB_VERSION = 4;  // 升级版本

// Chunk parameters
export const CHUNK_MAX_TOKENS = 200;

const db = new Dexie(DB_NAME);

// v3 -> v4: 新增 lexicalIndex 表，持久化词法索引快照（MiniSearch 序列化），
// 让页面刷新后无需 40s 全量重建，仅按楼层/事件签名 diff 增量恢复。
db.version(3).stores({
    meta: 'chatId',
    chunks: '[chatId+chunkId], chatId, [chatId+floor]',
    chunkVectors: '[chatId+chunkId], chatId',
    eventVectors: '[chatId+eventId], chatId',
    stateVectors: '[chatId+atomId], chatId, [chatId+floor]',  // L0 向量表
});

db.version(DB_VERSION).stores({
    meta: 'chatId',
    chunks: '[chatId+chunkId], chatId, [chatId+floor]',
    chunkVectors: '[chatId+chunkId], chatId',
    eventVectors: '[chatId+eventId], chatId',
    stateVectors: '[chatId+atomId], chatId, [chatId+floor]',  // L0 向量表
    lexicalIndex: 'chatId',  // 词法索引快照（每 chat 一条）
});

export { db };
export const metaTable = db.meta;
export const chunksTable = db.chunks;
export const chunkVectorsTable = db.chunkVectors;
export const eventVectorsTable = db.eventVectors;
export const stateVectorsTable = db.stateVectors;
export const lexicalIndexTable = db.lexicalIndex;
