import type { D20CheckRecord } from '../domain/check-records.js';
import { createD20 } from './d20.js';
import { diceSpan } from './card-elements.js';

const OUTCOMES = { critical_failure: '大失败', failure: '失败', success: '成功', critical_success: '大成功' };

export function createD20Result(record: D20CheckRecord) {
    const element = diceSpan('xb-dice-hero');
    const die = diceSpan('xb-dice-die');
    const solid = createD20(record.roll);
    die.append(solid.element, diceSpan('xb-dice-system', 'D20'));
    const verdict = diceSpan('xb-dice-verdict');
    const outcome = diceSpan('xb-dice-outcome');
    const comparison = diceSpan('xb-dice-comparison');
    const roll = diceSpan('xb-dice-score');
    roll.append(diceSpan('xb-dice-score-label', '掷骰'), diceSpan('xb-dice-score-value', String(record.roll)));
    const difficulty = diceSpan('xb-dice-score');
    difficulty.append(diceSpan('xb-dice-score-label', '难度'), diceSpan('xb-dice-score-value', String(record.dc)));
    comparison.append(roll, difficulty);
    verdict.append(outcome, comparison);
    verdict.hidden = true;
    element.append(die, verdict);
    return { element, rollingSlot: element, tone: record.outcome,
        label: `${OUTCOMES[record.outcome]}，掷骰 ${record.roll}，难度 ${record.dc}`,
        settle() { outcome.textContent = OUTCOMES[record.outcome]; verdict.hidden = false; solid.draw(1, true); },
        draw: solid.draw };
}
