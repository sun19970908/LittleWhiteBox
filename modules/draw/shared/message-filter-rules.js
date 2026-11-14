// 消息过滤规则的共享约定：每条规则是 { start, end }，可选 keep: true。
// keep 缺省/false：命中的片段从发给规划 AI 的文本里删除，且片段内不会出现插图点（原行为）。
// keep === true：片段文本保留给 AI 阅读，但片段内部不生成插图点。
// 存储时只有勾选了 keep 才写入 keep: true，其余规则保持 { start, end }，旧数据与旧测试不受影响。

// scene-source.js 里内联了同样的判断（不能多 import 文件，原因见那边的注释）；改这里时两处一起改，message-filter-rules.test.js 会对比两者的行为。
export const DEFAULT_MESSAGE_FILTER_RULES = [
    { start: '<think>', end: '</think>' },
    { start: '<thinking>', end: '</thinking>' },
    { start: '<system>', end: '</system>' },
    { start: '<meta>', end: '</meta>' },
    { start: '<options>', end: '</options>' },
    { start: '<WorldState>', end: '</WorldState>' },
    { start: '<state>', end: '</state>' },
    { start: '<UpdateVariable>', end: '</UpdateVariable>' },
    { start: '<—', end: '—>' },
    { start: '', end: '</think>' },
    { start: '<status>', end: '</status>' },
    { start: '<status_bar>', end: '</status_bar>' },
    { start: '<状态栏>', end: '</状态栏>' },
    { start: '<状态>', end: '</状态>' },
    { start: '<mind>', end: '</mind>' },
];

export function isRuleKept(rule) {
    return rule?.keep === true;
}

export function normalizeMessageFilterRule(rule) {
    const normalized = { start: String(rule?.start || ''), end: String(rule?.end || '') };
    if (isRuleKept(rule)) normalized.keep = true;
    return normalized;
}

export function normalizeMessageFilterRules(rules) {
    return (Array.isArray(rules) ? rules : [])
        .filter(rule => rule && typeof rule === 'object')
        .map(normalizeMessageFilterRule);
}
