// ═══════════════════════════════════════════════════════════════════════════
// Story Summary - 加载时 textHash 对账
// ═══════════════════════════════════════════════════════════════════════════
//
// 为什么需要：
//   - chunks 表写入路径里 hashText(cleanText) 是确定性的，但任何"已存
//     chunks 跟当前 chat 正文对不上"的状态都会让向量检索召回旧文本。
//   - MESSAGE_EDITED 事件只能覆盖本机编辑；多设备同步场景下，Device B
//     拿到新聊天文件但 ST 不会逐条重发 MESSAGE_EDITED，本机 chunks 跟正文
//     漂移但向量仍有效。
//   - 此模块只做检测，不做任何写入。drift floor 报给上层，由 toast /
//     rebuild 决策层决定怎么处理。
//
// 设计要点：
//   - 复用 chunkMessage 重算，确保跟写入路径走完全相同的 filterText /
//     去 <state> / 去 [tts:] / 切分逻辑。
//   - chunkId = c-{floor}-{chunkIdx}，跟 chunkMessage 的 makeChunkId 强绑定，
//     长度不一致 = chunk 数量漂移，hash 不一致 = 文本漂移。
//   - 短路：首个 drift floor 一旦找到就记录，继续扫下一个而不是直接返回，
//     让上层一次拿到所有 drift 楼层（5000 楼全扫仍在亚秒级）。
//   - 边界：lastChunkFloor < 0 时直接返回空数组；floor 区间超出 chat 长度
//     时取 min。
//   - 空正文 + DB 有 chunks 也算漂移；filterText 把所有内容都吃掉也算漂移。
//
// 奇数下标跳过：
//   小白x 在隐藏楼层时会默认编辑所有 AI 回复（在该扩展的典型聊天布局下，
//   chat[0] 是 AI 开场白，所以 AI 楼正好落在 0-base 偶数下标 0, 2, 4...
//   而用户在 0-base 奇数下标 1, 3, 5...）。这些被改过的 AI 楼会必然
//   触发 textHash 不一致，但对账系统无法区分"被隐藏功能改的"和"被外部
//   编辑的"。保守策略：直接跳过 0-base 偶数下标（AI 楼），避免假阳性。
//   日志输出用 1-based，所以用户看到的"奇数楼"（3, 5, 7...）就是
//   0-base 偶数（2, 4, 6...）。如果将来扩展 layout 变了，需把这个判断
//   改成基于 message.is_user 或其他显式信号。

import { getAllChunks } from '../storage/chunk-store.js';
import { chunkMessage } from './chunk-builder.js';

const EMPTY = 0;

/**
 * 扫描 [0, lastChunkFloor] 范围内每个楼层，检测 chunks.textHash 是否仍跟
 * 当前 chat 正文经同一过滤 + 切分后产生的 hash 一致。
 *
 * 跳过奇数下标楼层（小白x hide 功能会编辑这些用户楼层，视为预期修改）。
 *
 * @param {string} chatId
 * @param {Array} chat  当前聊天快照（已 load 过的 getContext().chat）
 * @param {number} lastChunkFloor  meta.lastChunkFloor，未向量化为 -1
 * @returns {Promise<number[]>} 全部 drift floor（升序，0-based）；无 drift 返回空数组
 */
export async function findStaleTextHashFloors(chatId, chat, lastChunkFloor) {
    if (!chatId || !Array.isArray(chat) || lastChunkFloor < EMPTY) return [];
    const upper = Math.min(lastChunkFloor, chat.length - 1);
    if (upper < EMPTY) return [];

    const storedChunks = await getAllChunks(chatId);
    if (storedChunks.length === 0) return [];

    // 索引：chunkId → stored, floor → stored[]
    const storedByKey = new Map();
    const storedByFloor = new Map();
    for (const c of storedChunks) {
        storedByKey.set(c.chunkId, c);
        const list = storedByFloor.get(c.floor);
        if (list) list.push(c);
        else storedByFloor.set(c.floor, [c]);
    }

    const driftFloors = [];

    for (let floor = 0; floor <= upper; floor++) {
        // 临时禁用：跳过 AI 楼的 filter（用户想看 AI 楼漂移情况）
        // if (floor % 2 === 0) continue;

        const message = chat[floor];
        const messageText = String(message?.mes || '').trim();
        const storedAtFloor = storedByFloor.get(floor) || [];

        // 正文为空：DB 里这一层若有 chunks 则视为漂移（曾经写过被清空）
        if (!messageText) {
            if (storedAtFloor.length > 0) driftFloors.push(floor);
            continue;
        }

        // 用 chunkMessage 走同一路径重算期望 chunks
        let expected;
        try {
            expected = chunkMessage(floor, message);
        } catch {
            // chunkMessage 抛错（极少见）→ 保守按漂移处理，让上层走重建路径
            driftFloors.push(floor);
            continue;
        }

        // filterText 把所有内容都吃掉 → 期望 0 chunks
        if (!Array.isArray(expected) || expected.length === 0) {
            if (storedAtFloor.length > 0) driftFloors.push(floor);
            continue;
        }

        // chunk 数量变化（消息变长被切多段 / 变短被合并）→ 漂移
        if (storedAtFloor.length !== expected.length) {
            driftFloors.push(floor);
            continue;
        }

        // 每个 chunk 的 textHash 对账
        let floorStale = false;
        for (const exp of expected) {
            const stored = storedByKey.get(exp.chunkId);
            if (!stored || stored.textHash !== exp.textHash) {
                floorStale = true;
                break;
            }
        }
        if (floorStale) driftFloors.push(floor);
    }

    return driftFloors;
}
