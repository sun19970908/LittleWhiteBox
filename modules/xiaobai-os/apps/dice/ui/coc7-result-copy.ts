import { COC7_DIFFICULTIES, type Coc7Difficulty } from '../domain/coc7-request.js';
import type { Coc7Resolution } from '../domain/coc7-record.js';

const difficulties: Record<Coc7Difficulty, string> = { easy: '简单', regular: '普通', hard: '困难', extreme: '极难' };
const levels = { critical: '大成功', extreme: '极难成功', hard: '困难成功', regular: '普通成功', easy: '简单成功', failure: '失败', fumble: '大失败' };
export const COC7_RESULT_COPY = {
    levels,
    verdicts: { achieved: '成功', not_achieved: '失败' },
    roll: '掷出', ceiling: '需不超过',
    identity: (stat: string, value: number, resolution?: Coc7Resolution) => resolution?.kind === 'mapped'
        ? `${resolution.input} → ${stat} · ${value}` : resolution?.kind === 'untrained' ? `${stat} · 未受训 ${value}` : `${stat} ${value}`,
    untrainedReasons: { unknown: '未匹配到已有能力', ambiguous: '匹配到多项能力，未指定单项' },
    system: (difficulty: Coc7Difficulty) => `D100 · ${difficulties[difficulty]}`,
    basis: (difficulty: Coc7Difficulty, value: number, threshold: number) => {
        const rule = COC7_DIFFICULTIES[difficulty];
        return `${difficulties[difficulty]}要求：${rule.kind === 'bonus'
            ? `${value} + ${rule.amount}${value + rule.amount > rule.cap ? `，上限 ${rule.cap}` : ''} → ${threshold}`
            : rule.divisor === 1 ? value : `${value} ÷ ${rule.divisor} → ${threshold}`}`;
    },
    critical: (roll: number) => `掷出 ${roll}，大成功直接通过。`,
    fumble: (minimum: number) => `${minimum === 100 ? '100' : `${minimum}–100`} 为本次大失败区间，优先判定失败。`,
    hundred: '00 + 0 按 100 计',
    accessible: (stat: string, outcome: string, roll: number, threshold: number, basis: string, explanation: string) =>
        `${stat}检定：${outcome}，掷出 ${roll}，成功上限 ${threshold}；${basis}${explanation ? `；${explanation}` : ''}`,
} as const;
