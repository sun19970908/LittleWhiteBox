import { COC7_POINTS, COC7_POINT_GROUPS } from '../domain/coc7-sheet.js';
import { COC7_RESET_COST } from '../domain/coc7-reset.js';
import { COC7_SHEET_COPY } from '../application/sheet-copy.js';

export const COC7_UI = {
    ...COC7_SHEET_COPY,
    title: '人物属性', rule: 'D100 属性鉴定', generate: '一键随机', close: '关闭人物属性',
    saved: '已保存', repair: '需重新分配', repairNotice: '人物属性需重新分配，新检定已暂停。',
    save: '保存', saving: '保存中…', cancel: '取消修改', reset: '重置', confirmReset: '确认重置',
    resetQuestion: '是否确认重置？', cancelReset: '取消', resetting: '重置中…',
    resetNotice: `花费 ${COC7_RESET_COST} 小白币，清空已保存的人物属性。聊天和已掷结果保留。`,
    damaged: '人物属性不符合当前分配规则，请重新分配或重置。操作成功前保留原数据，历史骰子不变。',
    scope: '全局保存',
    attributes: '属性', skills: '技能', remaining: '剩余', allocated: '已分配',
    unassigned: '待分配', unsaved: '未保存', decrease: '减少', increase: '增加',
    limits: `属性 ${COC7_POINT_GROUPS.attributes.min}–${COC7_POINTS.max} · 技能 ${COC7_POINT_GROUPS.skills.min}–${COC7_POINTS.max} · 每次 ${COC7_POINTS.step} 点；无需花完点数。`,
    invalidAllocation: '分配不符合点数或单项范围，请调整后保存。',
    saveFailed: '属性未能保存，草稿已保留，请重试。',
    resetFailed: '重置失败，原属性已保留，请重试。',
    description: '仅检定你扮演的角色，使用全局人物能力，按属性或技能掷百分骰。',
} as const;
