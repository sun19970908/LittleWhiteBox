// ═══════════════════════════════════════════════════════════════════════════
// floor-boundary.js - 近处楼层禁召边界（滚动窗口）
//
// 背景：
// 查询向量由最近 3 条消息加权得到（query-builder.js），因此离当前越近的楼层
// 与 query 的余弦天然越高，dense 召回会稳定扎堆在最近几层；lexical 通道同理
// （近处楼层与当前消息用词重合度最高）。这些近处信息大多已在聊天上下文里，
// 召回它们既浪费预算又挤掉远期记忆。
//
// 语义：
// 以「当前对话最后楼层」为基准的最近 N 层不参与召回。窗口随对话推进自动
// 前移，不是固定楼层号。
//     blockedFrom = latestFloor - N + 1
//     floor >= blockedFrom  →  禁召
//
// 作用域（由调用方决定，本模块只提供判定）：
// L0 dense anchor / L2 event / lexical floor / PPR 扩散 / direct evidence 展开。
//
// 本模块为纯函数、零依赖，避免 recall.js / diffusion.js / direct-evidence-*
// 之间互相 import 形成环。
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 禁召窗口宽度（层数）。
 *
 * 0 = 关闭，行为与未接入前完全一致（默认值，便于回归对比）。
 * 建议取值 4~8：查询向量来自最近 3 条消息（约 1~2 个 L0 楼层对），
 * 取 4~8 层才能覆盖住「已经在聊天上下文里」的范围；过大容易误伤远期记忆。
 */
export const FLOOR_BOUNDARY_LOOKBACK = 0;

// ─────────────────────────────────────────────────────────────────────────────
// 持久化：extension_settings.LittleWhiteBox.storySummary.floorBoundaryLookback
//
// 与 LWB 其他开关（driftCheckEnabled / builtinTextFilters / promptBudgets）同一套
// 存法：随设置导出、由 saveSettingsDebounced 落盘、循环任务一个 setter 即可改。
//
// 采用 top-level await + 动态 import 而非静态 import：本模块被 node 单测直接
// import 时这两个浏览器侧模块取不到，动态 import 失败走 catch 降级成「不持久化」，
// 判定逻辑依然可测。
// ─────────────────────────────────────────────────────────────────────────────

let settingsRoot = null;
let persistSettings = null;

try {
    const ext = await import('../../../../../../../extensions.js');
    const script = await import('../../../../../../../../script.js');
    settingsRoot = ext?.extension_settings ?? null;
    persistSettings = typeof script?.saveSettingsDebounced === 'function'
        ? script.saveSettingsDebounced
        : null;
} catch {
    settingsRoot = null;
    persistSettings = null;
}

const EXT_ID = 'LittleWhiteBox';
const STORY_SUMMARY_KEY = 'storySummary';
const SETTINGS_KEY = 'floorBoundaryLookback';

function readPersistedLookback() {
    const v = settingsRoot?.[EXT_ID]?.[STORY_SUMMARY_KEY]?.[SETTINGS_KEY];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function writePersistedLookback(value) {
    if (!settingsRoot) return;
    try {
        const root = (settingsRoot[EXT_ID] ??= {});
        root[STORY_SUMMARY_KEY] ??= {};
        if (value == null) delete root[STORY_SUMMARY_KEY][SETTINGS_KEY];
        else root[STORY_SUMMARY_KEY][SETTINGS_KEY] = value;
        persistSettings?.();
    } catch {
        // 设置不可用时静默降级为不持久化
    }
}

/**
 * 运行期覆盖值（未持久化）。
 *
 * 存在的理由：ES module 的 const 导出在外部无法赋值，N 要支持运行期调整
 * （尤其是循环任务注入）必须经由可变槽位。
 */
let runtimeLookback = null;

/**
 * 持久化值，模块加载时从 localStorage 恢复。
 */
let persistedLookback = readPersistedLookback();

/**
 * 当前生效的 N：运行期覆盖 > 持久化值 > 常量。
 * @returns {number}
 */
export function getFloorBoundaryLookback() {
    if (runtimeLookback != null) return runtimeLookback;
    if (persistedLookback != null) return persistedLookback;
    return FLOOR_BOUNDARY_LOOKBACK;
}

/**
 * 设置 N（循环任务入口）。
 *
 * @param {number|null} value - >= 0 的整数；null / undefined / '' = 清除
 * @param {boolean} [persist=true] - 是否写入 localStorage（true 时刷新后仍生效）
 * @returns {number} 设置后实际生效的 N
 */
export function setFloorBoundaryLookback(value, persist = true) {
    // null / undefined / '' 表示清除；注意不能走 Number()，否则 null 会被当成 N=0。
    const cleared = value === null || value === undefined || value === '';
    const raw = cleared ? Number.NaN : Number(value);
    const n = Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;

    runtimeLookback = n;
    if (persist) {
        persistedLookback = n;
        writePersistedLookback(n);
    }
    return getFloorBoundaryLookback();
}

/**
 * 清除持久化值与运行期覆盖，回落到常量 FLOOR_BOUNDARY_LOOKBACK。
 * @returns {number} 生效的 N
 */
export function clearFloorBoundaryLookback() {
    return setFloorBoundaryLookback(null, true);
}

/**
 * 边界对象（resolveFloorBoundary 的返回值）。
 *
 * @typedef {object} FloorBoundary
 * @property {boolean} enabled - false 表示不启用，所有判定恒为 false
 * @property {number} lookback - 实际生效的窗口宽度
 * @property {number} latestFloor - 基准楼层（对话最后楼层）
 * @property {number} blockedFrom - 禁召起始楼层，floor >= blockedFrom 即禁召
 */

/**
 * 计算滚动边界。
 *
 * 基准取「对话真实最后楼层」而非 meta.lastChunkFloor：后者是已向量化进度，
 * 滞后于真实楼层，会让边界漂移、导致近处楼层漏网。
 *
 * @param {Array|number} chat - 消息数组（取其 length）或直接传楼层总数
 * @param {number} [lookback] - 窗口宽度，默认取当前生效的 N（getFloorBoundaryLookback）
 * @returns {FloorBoundary}
 */
export function resolveFloorBoundary(chat, lookback = getFloorBoundaryLookback()) {
    const total = Array.isArray(chat) ? chat.length : Number(chat);
    const n = Number.isFinite(lookback) ? Math.trunc(lookback) : 0;

    if (!Number.isFinite(total) || total <= 0 || n <= 0) {
        return { enabled: false, lookback: 0, latestFloor: -1, blockedFrom: Number.POSITIVE_INFINITY };
    }

    const latestFloor = total - 1;
    const blockedFrom = latestFloor - n + 1;

    // 对话比窗口还短：禁区会吞掉全部楼层，直接关闭，避免召回全空。
    if (blockedFrom <= 0) {
        return { enabled: false, lookback: n, latestFloor, blockedFrom: Number.POSITIVE_INFINITY };
    }

    return { enabled: true, lookback: n, latestFloor, blockedFrom };
}

/**
 * 单个楼层是否在禁区内。
 *
 * floor 无法解析时返回 false（不拦未知来源的数据，避免误杀）。
 *
 * @param {number} floor
 * @param {FloorBoundary|null} boundary
 * @returns {boolean}
 */
export function isFloorBlocked(floor, boundary) {
    if (!boundary?.enabled) return false;
    const f = Number(floor);
    if (!Number.isInteger(f)) return false;
    return f >= boundary.blockedFrom;
}

/**
 * 批量过滤楼层数组（返回新数组）。
 *
 * @param {Iterable<number>} floors
 * @param {FloorBoundary|null} boundary
 * @returns {number[]}
 */
export function filterBlockedFloors(floors, boundary) {
    if (!boundary?.enabled) return [...(floors || [])];
    const out = [];
    for (const floor of floors || []) {
        if (!isFloorBlocked(floor, boundary)) out.push(floor);
    }
    return out;
}

/**
 * 事件楼层区间是否被禁。
 *
 * 规则：只有事件**整体**落入禁区才丢弃（range.start >= blockedFrom）。
 * 跨边界的长事件（start 在区外、end 在区内）予以保留，因为它主要讲述的
 * 是边界外的事；但其展开出的 direct evidence 楼层仍需在下游逐个过滤，
 * 否则近处原文会借事件的壳子回到 prompt。
 *
 * 另一种更激进的策略是「与禁区有交集即丢弃」（range.end >= blockedFrom），
 * 信息损失更大，当前未采用。
 *
 * @param {{start: number, end: number}|null} range - parseEventRange 的结果
 * @param {FloorBoundary|null} boundary
 * @returns {boolean}
 */
export function isEventRangeBlocked(range, boundary) {
    if (!boundary?.enabled) return false;
    if (!range || !Number.isFinite(range.start)) return false;
    return Number(range.start) >= boundary.blockedFrom;
}

/**
 * 边界统计容器。由 recall.js 挂在 metrics.floorBoundary 上，供顶端（候选生成层）
 * 与末端（prompt 装配层）分别累加，最后由 formatBoundaryLog 一次性输出。
 *
 * @returns {object}
 */
export function createBoundaryStats() {
    return {
        enabled: false,
        lookback: 0,
        latestFloor: -1,
        blockedFrom: null,
        // 顶端：让出 fusion / rerank / event 名额
        blockedAnchors: 0,
        blockedEventCandidates: 0,
        blockedLexFloors: 0,
        // 末端：保证近处楼层不进 prompt
        blockedL0: 0,
        blockedL1Floors: 0,
        blockedEvents: 0,
        blockedDirectItems: 0,
    };
}

/**
 * 把边界统计格式化成日志文本（供 console.info 输出）。
 *
 * @param {object|null} stats - createBoundaryStats() 的返回值
 * @returns {string}
 */
export function formatBoundaryLog(stats) {
    if (!stats) return '';
    if (!stats.enabled) {
        return `[Floor Boundary] 近处楼层禁召\n└─ disabled (N=${stats.lookback || 0})`;
    }
    return [
        '[Floor Boundary] 近处楼层禁召',
        `├─ window: floor >= ${stats.blockedFrom} (latest=${stats.latestFloor}, N=${stats.lookback})`,
        `├─ top: anchors=${stats.blockedAnchors || 0}, event_candidates=${stats.blockedEventCandidates || 0}, lex_floors=${stats.blockedLexFloors || 0}`,
        `└─ tail: l0=${stats.blockedL0 || 0}, l1_floors=${stats.blockedL1Floors || 0}, events=${stats.blockedEvents || 0}, direct_items=${stats.blockedDirectItems || 0}`,
    ].join('\n');
}
