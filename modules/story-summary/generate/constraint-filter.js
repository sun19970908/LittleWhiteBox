import { extension_settings } from "../../../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../../../script.js";
import { normalizeUserIdentityKey } from '../data/character-aliases.js';
import { isRelationFact, parseRelationTarget } from '../data/fact-predicates.js';

const EXT_ID = "LittleWhiteBox";
const KEEP_STATE_FACTS_KEY = "keepStateFacts";

// ── state 约束直接保留 开关 ─────────────────────────────
// 默认打开：_isState === true 的事实直接保留；
// 关闭后：state 事实按常规相关性过滤。
export function isKeepStateFactsEnabled() {
    const v = extension_settings?.[EXT_ID]?.storySummary?.[KEEP_STATE_FACTS_KEY];
    return v === undefined ? true : v === true;
}

export function toggleKeepStateFacts() {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    const next = !isKeepStateFactsEnabled();
    root.storySummary[KEEP_STATE_FACTS_KEY] = next;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return next;
}

// ── L3 人物屏蔽 配置 ─────────────────────────────────
// ① 按主体屏蔽：blockedCharacters（数组，默认空 = 不屏蔽）。
//    命中 fact.s 即删除该条事实（关系/非关系一视同仁，只看主体 s）。
//    例：屏蔽「小明」→ 删除 {s:小明,...} 与 {s:小明,p:对B的看法}；
//        保留 {s:B,p:对小明的看法}（s=B，未命中）。
// ② 完全屏蔽 world：blockWorld（布尔，默认关）。打开后 world 段整体不注入。
// ③ 完全屏蔽 people：blockPeople（布尔，默认关）。打开后 people 段整体不注入。
const BLOCKED_CHARACTERS_KEY = "blockedCharacters";
const BLOCK_WORLD_KEY = "blockWorld";
const BLOCK_PEOPLE_KEY = "blockPeople";

export function getBlockedCharacters() {
    const v = extension_settings?.[EXT_ID]?.storySummary?.[BLOCKED_CHARACTERS_KEY];
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map(s => String(s || '').trim()).filter(Boolean))];
}

export function setBlockedCharacters(list) {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    root.storySummary[BLOCKED_CHARACTERS_KEY] =
        Array.isArray(list) ? list.map(s => String(s || '').trim()).filter(Boolean) : [];
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return getBlockedCharacters();
}

export function isBlockWorldEnabled() {
    const v = extension_settings?.[EXT_ID]?.storySummary?.[BLOCK_WORLD_KEY];
    return v === undefined ? false : v === true;
}

export function setBlockWorld(flag) {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    root.storySummary[BLOCK_WORLD_KEY] = !!flag;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return isBlockWorldEnabled();
}

export function isBlockPeopleEnabled() {
    const v = extension_settings?.[EXT_ID]?.storySummary?.[BLOCK_PEOPLE_KEY];
    return v === undefined ? false : v === true;
}

export function setBlockPeople(flag) {
    const root = (extension_settings[EXT_ID] ??= {});
    root.storySummary ??= {};
    root.storySummary[BLOCK_PEOPLE_KEY] = !!flag;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
    return isBlockPeopleEnabled();
}

function normalize(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase();
}

export function filterConstraintsByRelevance(facts, focusCharacters, knownCharacters, userName = '') {
    if (!facts?.length) return [];

    const focusSet = new Set((focusCharacters || []).map(normalize));
    const userKey = normalizeUserIdentityKey(userName);
    const keepStateFacts = isKeepStateFactsEnabled();
    const blockedSet = new Set(getBlockedCharacters().map(normalize));

    return facts.filter(fact => {
        // 按主体屏蔽（先于 state 直接保留：被屏蔽人物的 state 事实也一并排除）
        if (blockedSet.has(normalize(fact?.s))) return false;

        // state 约束直接保留（开关，默认打开）
        if (keepStateFacts && fact._isState === true) return true;

        if (isRelationFact(fact)) {
            const from = normalize(fact.s);
            const target = parseRelationTarget(fact.p);
            const to = target ? normalize(target) : '';
            return focusSet.has(from) || focusSet.has(to);
        }

        const subject = normalize(fact.s);
        if (userKey && normalizeUserIdentityKey(fact.s) === userKey) return true;
        if (knownCharacters.has(subject)) return focusSet.has(subject);
        return true;
    });
}