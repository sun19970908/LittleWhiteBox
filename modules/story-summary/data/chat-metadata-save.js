// ═══════════════════════════════════════════════════════════════════════════
// Story Summary - Chat Metadata Save
//
// 统一收敛剧情总结的聊天 metadata 落盘通道。
//
// 背景：酒馆的 saveMetadata() 等价于 saveChatConditional()，会把整个聊天数组序列化后全量写盘。
//       聊天文件很大时（几十 MB），任何一次 metadata 写入都要付出一次全量序列化 + 落盘代价。
//       TauriTavern 提供 handle.metadata.setExtension()：后端只解析聊天文件首行、仅重写 metadata，
//       消息部分按字节流复制，不解析、不重新序列化。
//
// 本模块只负责「选通道 + 排队 + 防抖 + 去重」，不改变任何数据结构，也不迁移数据：
//   - TauriTavern 通道可用：handle.metadata.setExtension({ namespace: EXT_ID, value })
//   - 其它环境：调用方传入的 fallback（等价于原有 saveMetadata / saveMetadataDebounced）
//
// 使用约束（必须遵守）：
//   1. 调用方必须「先改内存、再调本模块」。本模块在真正落盘的那一刻才读取传入 metadata 的当前值；
//      若只落盘而不同步内存，之后任意一次全量保存都会用旧内存态覆盖磁盘。
//   2. setExtension 对 namespace 是整体覆盖写，因此落盘的是内存中完整的 extensions[EXT_ID] 子树。
//   3. 立即保存（saveChatMetadataNow）失败会抛出，由调用方决定是否回滚内存；
//      防抖保存（saveChatMetadataDebounced）即发即忘，失败仅告警并保留待写状态。
//   4. 落盘仍需一次剩余文件的字节拷贝（O(文件大小) I/O），属于数量级改进而非零开销。
// ═══════════════════════════════════════════════════════════════════════════

import { EXT_ID } from '../../../core/constants.js';
import { xbLog } from '../../../core/debug-core.js';

const MODULE_ID = 'chatMetadataSave';

// 对齐酒馆 debounce_timeout.relaxed（1000ms），保证调用方的时序感知一致
const DEBOUNCE_DELAY_MS = 1000;

let debounceTimer = null;
let dirtyVersion = 0;      // 内存态变更代数：每次请求落盘自增
let persistedVersion = 0;  // 已成功落盘到的代数
let flushPromise = null;   // 进行中/待执行的落盘链
let trailingRequested = false;
let currentMetadata = null;
let currentReason = '';
let writeCount = 0;
let skipCount = 0;
let lastWriteAt = 0;

/**
 * 同步探测 TauriTavern 的 metadata 专用通道是否可用。
 * 刻意不 await 宿主的 ready Promise：调用方需要在同步路径上决定是否分流。
 * @param {any} [host]
 * @returns {boolean}
 */
export function isTauriTavernMetadataChannelAvailable(host = globalThis.window) {
    try {
        const chatApi = host?.__TAURITAVERN__?.api?.chat;
        return typeof chatApi?.current?.handle === 'function';
    } catch {
        return false;
    }
}

function resolveTauriTavernHandle(host = globalThis.window) {
    try {
        const chatApi = host?.__TAURITAVERN__?.api?.chat;
        if (typeof chatApi?.current?.handle !== 'function') return null;
        const handle = chatApi.current.handle();
        return typeof handle?.metadata?.setExtension === 'function' ? handle : null;
    } catch (error) {
        xbLog.warn(MODULE_ID, `获取 TauriTavern 聊天句柄失败: ${error?.message || error}`);
        return null;
    }
}

/** 读取内存中当前聊天的 LittleWhiteBox 子树（整体覆盖写的取值来源）。 */
function readExtensionNamespace(metadata) {
    const value = metadata?.extensions?.[EXT_ID];
    return value && typeof value === 'object' ? value : null;
}

function clearDebounceTimer() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

/**
 * 单次落盘。写入期间到达的新请求由 flush 链尾随重跑，避免高频调用重复写盘。
 * 自上次成功落盘以来无新变更时直接跳过（与宿主的写盘内容指纹去重互补）。
 */
async function writeOnce() {
    if (persistedVersion >= dirtyVersion) {
        skipCount += 1;
        return;
    }

    const versionAtWrite = dirtyVersion;
    const value = readExtensionNamespace(currentMetadata);
    if (!value) {
        // 内存里没有该 namespace（例如已清空）：无需落盘，直接记为已同步
        persistedVersion = Math.max(persistedVersion, versionAtWrite);
        skipCount += 1;
        return;
    }

    const handle = resolveTauriTavernHandle();
    if (!handle) {
        throw new Error('chat_metadata_save_channel_unavailable');
    }

    const startedAt = Date.now();
    await handle.metadata.setExtension({ namespace: EXT_ID, value });
    persistedVersion = Math.max(persistedVersion, versionAtWrite);
    lastWriteAt = Date.now();
    writeCount += 1;
    xbLog.info(MODULE_ID, `metadata 已落盘(TauriTavern) reason=${currentReason || '-'} 耗时=${lastWriteAt - startedAt}ms`);
}

function requestFlush() {
    if (flushPromise) {
        trailingRequested = true;
        return flushPromise;
    }

    flushPromise = (async () => {
        try {
            do {
                trailingRequested = false;
                await writeOnce();
            } while (trailingRequested);
        } finally {
            flushPromise = null;
        }
    })();

    return flushPromise;
}

/**
 * 防抖保存：即发即忘，失败仅告警并保留待写状态，由后续调用重试。
 * @param {{ metadata?: any, fallback?: () => void, reason?: string }} [options]
 */
export function saveChatMetadataDebounced({ metadata, fallback, reason = 'debounced' } = {}) {
    if (metadata) {
        currentMetadata = metadata;
    }
    currentReason = reason;
    dirtyVersion += 1;

    if (!isTauriTavernMetadataChannelAvailable()) {
        // 非 TauriTavern：完全沿用酒馆原有防抖实现（自带去重与时序），行为不变
        try {
            fallback?.();
        } catch (error) {
            xbLog.warn(MODULE_ID, `metadata 防抖保存失败: ${error?.message || error}`);
        }
        return;
    }

    clearDebounceTimer();
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        requestFlush().catch(error => {
            xbLog.warn(MODULE_ID, `metadata 防抖落盘失败: ${error?.message || error}`);
        });
    }, DEBOUNCE_DELAY_MS);
}

/**
 * 立即保存：失败会抛出，调用方据此回滚内存。
 * @param {{ metadata?: any, fallback?: () => Promise<unknown> | unknown, reason?: string }} [options]
 * @returns {Promise<void>}
 */
export async function saveChatMetadataNow({ metadata, fallback, reason = 'immediate' } = {}) {
    if (metadata) {
        currentMetadata = metadata;
    }
    currentReason = reason;
    dirtyVersion += 1;

    if (!isTauriTavernMetadataChannelAvailable()) {
        if (typeof fallback !== 'function') {
            throw new Error('chat_metadata_save_fallback_unavailable');
        }
        await fallback();
        persistedVersion = Math.max(persistedVersion, dirtyVersion);
        return;
    }

    clearDebounceTimer();
    await requestFlush();
}

/**
 * 冲刷待写任务（含防抖计时器）。用于退出前或测试收尾。
 * @returns {Promise<boolean>} 是否走了 TauriTavern 通道
 */
export async function flushChatMetadataSave() {
    clearDebounceTimer();
    if (!isTauriTavernMetadataChannelAvailable()) {
        return false;
    }
    await requestFlush();
    return true;
}

/** 重置内部状态（切聊天或测试隔离用）。 */
export function resetChatMetadataSaveState() {
    clearDebounceTimer();
    dirtyVersion = 0;
    persistedVersion = 0;
    currentMetadata = null;
    currentReason = '';
    writeCount = 0;
    skipCount = 0;
    lastWriteAt = 0;
}

/** 观测用的落盘统计。 */
export function getChatMetadataSaveStats() {
    return Object.freeze({
        dirtyVersion,
        persistedVersion,
        writeCount,
        skipCount,
        lastWriteAt,
    });
}
