// Model output boundary. No store mutation; temporary references live only here.
import { sanitizeCharacterAliasUpdates } from '../data/character-aliases.js';
import { EVENT_MEMORY_ROLES } from '../data/events.js';
import { isRelationFact, RELATION_TRENDS } from '../data/fact-predicates.js';
import { parseModelArcProgress } from './arc-progress.js';

const FACT_PREDICATE_ALIASES = new Map([
    ['当前位置', '位置'], ['当前所在地', '位置'], ['所在位置', '位置'],
    ['所在地', '位置'], ['当前状态', '状态'],
]);
// Accept one extra cause beyond the prompt's target; never truncate valid links.
const MAX_DIRECT_CAUSES = 3;
const SOURCE_ERRORS = {
    source_missing: '缺少来源楼层标注',
    source_ambiguous: '来源楼层标注不唯一',
    source_format: '来源楼层须为 (#X)、(#X-Y) 或 (#X、#Y)',
    source_body_empty: '事件须有正文，不能只有楼层标注',
    source_range: '来源楼层须按顺序落在本批范围内',
};

function invalidSource(path, code) {
    const error = new Error(`${path}：${SOURCE_ERRORS[code]}`);
    error.code = code;
    error.path = path;
    throw error;
}

function invalid(path, reason) {
    const error = new Error(`${path}：${reason}`);
    error.code = 'invalid_summary_field';
    error.path = path;
    throw error;
}

function object(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, '须为对象');
    return value;
}

function text(value, path, allowEmpty = false) {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(path, '须为有效文本');
    return value.trim();
}

function array(value, path) {
    if (!Array.isArray(value)) invalid(path, '须为数组');
    return value;
}

function optionalArray(value, path) {
    return value === undefined ? [] : array(value, path);
}

function names(value, path) {
    return array(value, path).map((name, i) => text(name, `${path}[${i}]`));
}

function parseSourceMarkerBody(value) {
    // Normalize only source notation, never narrative text or other numerals.
    const body = value
        .replace(/[＃０-９－，]/gu, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
        .replace(/[−–—]/gu, '-')
        .trim();
    const range = body.match(/^(\d+)(?:\s*-\s*#?\s*(\d+))?$/u);
    if (range) return { list: false, floors: [Number(range[1]), Number(range[2] ?? range[1])] };
    if (/^\d+(?:\s*[,、]\s*#?\s*\d+)+$/u.test(body)) {
        return { list: true, floors: body.split(/\s*[,、]\s*#?\s*/u).map(Number) };
    }
    return null;
}

export function getNextEventId(existingEvents = []) {
    let maxId = 0;
    for (const event of existingEvents) {
        const match = typeof event?.id === 'string' && event.id.match(/^evt-(\d+)$/);
        if (match) maxId = Math.max(maxId, Number(match[1]));
    }
    return maxId + 1;
}

function eventSummary(value, path, startFloor, endFloor) {
    const summary = text(value, path);
    // Require the explicit # prefix so ordinary numeric parentheses stay prose.
    // Count malformed markers too: never silently drop an ambiguous source.
    const markers = [...summary.matchAll(/[（(]\s*[#＃]([^（）()]*)[）)]/gu)];
    if (!markers.length) invalidSource(path, 'source_missing');
    if (markers.length !== 1) invalidSource(path, 'source_ambiguous');
    const marker = markers[0];
    const parsed = parseSourceMarkerBody(marker[1]);
    if (!parsed) invalidSource(path, 'source_format');
    const { list, floors } = parsed;
    if (floors.some(floor => !Number.isSafeInteger(floor) || floor < startFloor || floor > endFloor)
        || (!list && floors[0] > floors[1])) {
        invalidSource(path, 'source_range');
    }
    // Project explicit sources to the runtime's continuous envelope once, at input.
    const start = floors.reduce((min, floor) => Math.min(min, floor));
    const end = floors.reduce((max, floor) => Math.max(max, floor));
    const canonicalMarker = `(#${start}${start === end ? '' : `-${end}`})`;
    const prefix = summary.slice(0, marker.index);
    const suffix = summary.slice(marker.index + marker[0].length);
    const prose = (prefix + suffix).trim();
    if (!prose) invalidSource(path, 'source_body_empty');
    // Retrieval still receives exactly one standard suffix, regardless of layout.
    return suffix ? `${prose} ${canonicalMarker}` : `${prefix}${canonicalMarker}`;
}

function resolveCauses(value, path, selfId, eventIds, newIds) {
    const refs = names(optionalArray(value, path), path);
    const resolved = refs.map((ref, i) => {
        const position = ref.match(/^new-([1-9]\d*)$/);
        const id = position ? newIds[Number(position[1]) - 1]
            : /^evt-\d+$/.test(ref) && eventIds.has(ref) ? ref : undefined;
        if (!id) invalid(`${path}[${i}]`, `引用 ${ref} 不存在；须指向已有事件或本批事件`);
        if (id === selfId) invalid(`${path}[${i}]`, '事件不能引用自身为前因');
        return id;
    });
    const unique = [...new Set(resolved)];
    if (unique.length > MAX_DIRECT_CAUSES) invalid(path, `直接前因最多为 ${MAX_DIRECT_CAUSES} 个`);
    return unique;
}

function prepareArc(update, path) {
    object(update, path);
    const name = text(update.name, `${path}.name`);
    const trajectory = text(update.trajectory, `${path}.trajectory`);
    const progress = parseModelArcProgress(update.progress);
    if (progress === null) invalid(`${path}.progress`, '须为有效数值或百分数');
    return {
        name, trajectory, progress,
        ...(update.newMoment === undefined ? {} : { newMoment: text(update.newMoment, `${path}.newMoment`, true) }),
    };
}

function prepareFact(update, path) {
    object(update, path);
    const s = text(update.s, `${path}.s`);
    const predicate = text(update.p, `${path}.p`);
    const p = FACT_PREDICATE_ALIASES.get(predicate) || predicate;
    if (update.retracted !== undefined && typeof update.retracted !== 'boolean') {
        invalid(`${path}.retracted`, '须为布尔值');
    }
    if (update.retracted === true) return { s, p, retracted: true };
    const o = text(update.o, `${path}.o`);
    if (typeof update.isState !== 'boolean') invalid(`${path}.isState`, '须为布尔值');
    const fact = { s, p, o, isState: update.isState };
    if (isRelationFact(fact) && update.trend != null) {
        const trend = text(update.trend, `${path}.trend`, true);
        if (trend) {
            if (!RELATION_TRENDS.includes(trend)) invalid(`${path}.trend`, '须为规定的关系趋势');
            fact.trend = trend;
        }
    }
    return fact;
}

/** Validate and project one generated batch before any merge or persistence. */
export function prepareSummaryResult(parsed, { existingEvents = [], startFloor, endFloor }) {
    object(parsed, 'summary');
    const rawEvents = array(parsed.events, 'events');
    const nextId = getNextEventId(existingEvents);
    if (rawEvents.length && (!Number.isSafeInteger(nextId)
        || rawEvents.length - 1 > Number.MAX_SAFE_INTEGER - nextId)) {
        invalid('events', '事件编号超出安全整数范围');
    }
    const newIds = rawEvents.map((_, i) => `evt-${nextId + i}`);
    // Bind against the complete batch before any event is merged or saved.
    const eventIds = new Set([...existingEvents.map(event => event.id), ...newIds]);
    const events = rawEvents.map((event, i) => {
        const path = `events[${i}]`;
        object(event, path);
        const memoryRole = event.memoryRole === undefined ? '' : text(event.memoryRole, `${path}.memoryRole`, true);
        if (memoryRole && !EVENT_MEMORY_ROLES.includes(memoryRole)) invalid(`${path}.memoryRole`, '须为规定的记忆类型');
        return {
            id: newIds[i],
            title: text(event.title, `${path}.title`),
            summary: eventSummary(event.summary, `${path}.summary`, startFloor, endFloor),
            ...(event.timeLabel === undefined ? {} : { timeLabel: text(event.timeLabel, `${path}.timeLabel`, true) }),
            participants: names(optionalArray(event.participants, `${path}.participants`), `${path}.participants`),
            memoryRole,
            causedBy: resolveCauses(event.causedBy, `${path}.causedBy`, newIds[i], eventIds, newIds),
        };
    });
    const arcUpdates = optionalArray(parsed.arcUpdates, 'arcUpdates').map((update, i) => prepareArc(update, `arcUpdates[${i}]`));
    const factUpdates = optionalArray(parsed.factUpdates, 'factUpdates').map((update, i) => prepareFact(update, `factUpdates[${i}]`));
    const keywords = optionalArray(parsed.keywords, 'keywords').map((keyword, i) => {
        const path = `keywords[${i}]`;
        object(keyword, path);
        if (!['核心', '重要', '一般'].includes(keyword.weight)) invalid(`${path}.weight`, '须为核心、重要或一般');
        return { text: text(keyword.text, `${path}.text`), weight: keyword.weight };
    });
    const newCharacters = names(optionalArray(parsed.newCharacters, 'newCharacters'), 'newCharacters');
    const aliasUpdates = optionalArray(parsed.characterAliasUpdates, 'characterAliasUpdates').map((update, i) => {
        const path = `characterAliasUpdates[${i}]`;
        object(update, path);
        const from = names(update.from, `${path}.from`);
        if (!from.length) invalid(`${path}.from`, '须包含旧称呼');
        return { to: text(update.to, `${path}.to`), from, evidence: text(update.evidence, `${path}.evidence`) };
    });
    return {
        events, arcUpdates, factUpdates, keywords, newCharacters,
        characterAliasUpdates: sanitizeCharacterAliasUpdates(aliasUpdates),
    };
}
