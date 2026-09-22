import type { Coc7CheckRecord } from '../domain/check-records.js';
import { COC7_DIFFICULTIES } from '../domain/coc7-request.js';
import { COC7_CRITICAL_ROLL, coc7FumbleMinimum } from '../domain/coc7.js';
import { diceSpan } from './card-elements.js';
import { COC7_RESULT_COPY as copy } from './coc7-result-copy.js';
import { createD10 } from './d10.js';

export function createCoc7Result(record: Coc7CheckRecord) {
    const { request, result, resolution } = record;
    const critical = result.level === 'critical', fumble = result.level === 'fumble';
    const special = critical || fumble;
    const outcome = special ? copy.levels[result.level] : copy.verdicts[result.verdict];
    const tone = critical ? 'critical_success' : fumble ? 'critical_failure' : result.verdict === 'achieved' ? 'success' : 'failure';
    const element = diceSpan('xb-dice-coc7');
    const heading = diceSpan('xb-dice-coc7-heading');
    const name = copy.identity(request.stat, result.value, resolution);
    const identity = diceSpan('xb-dice-coc7-identity', name);
    identity.dataset.resolution = resolution?.kind ?? 'direct';
    heading.append(identity, diceSpan('xb-dice-system', copy.system(request.difficulty)));
    const hero = diceSpan('xb-dice-coc7-hero');
    const dice = diceSpan('xb-dice-percentile-dice');
    const tens = createD10(result.tens, 'tens'), units = createD10(result.units, 'units');
    for (const die of [tens, units]) {
        const holder = diceSpan('xb-dice-percentile-die');
        holder.append(die.element); dice.append(holder);
    }
    const verdict = diceSpan('xb-dice-verdict');
    verdict.dataset.result = result.verdict;
    const comparison = diceSpan('xb-dice-coc7-comparison');
    comparison.dataset.comparison = special ? result.level : result.roll <= result.threshold ? 'at_or_below' : 'above';
    const roll = diceSpan('xb-dice-score');
    const rollValue = diceSpan('xb-dice-score-value', String(result.roll).padStart(2, '0'));
    rollValue.dataset.roll = String(result.roll);
    roll.append(diceSpan('xb-dice-score-label', copy.roll), rollValue);
    comparison.append(roll);
    if (!special) {
        const limit = diceSpan('xb-dice-score');
        const threshold = diceSpan('xb-dice-score-value', String(result.threshold));
        threshold.dataset.threshold = String(result.threshold);
        limit.append(diceSpan('xb-dice-score-label', copy.ceiling), threshold);
        comparison.append(diceSpan('xb-dice-operator', result.roll <= result.threshold ? '≤' : '>'), limit);
    }
    verdict.append(diceSpan('xb-dice-outcome', outcome), comparison);
    const basisText = copy.basis(request.difficulty, result.value, COC7_DIFFICULTIES[request.difficulty], result.threshold);
    const basis = diceSpan('xb-dice-coc7-basis', basisText);
    basis.dataset.value = String(result.value); basis.dataset.divisor = String(COC7_DIFFICULTIES[request.difficulty]); basis.dataset.threshold = String(result.threshold);
    let explanation = '';
    if (result.level === 'critical') { explanation = copy.critical(COC7_CRITICAL_ROLL); }
    else if (result.level === 'fumble') { explanation = copy.fumble(coc7FumbleMinimum(result.threshold)); }
    const detail = diceSpan('xb-dice-coc7-detail');
    detail.dataset.level = result.level;
    const sourceReason = resolution?.kind === 'untrained' ? copy.untrainedReasons[resolution.reason] : '';
    if (sourceReason) { detail.append(diceSpan('xb-dice-coc7-reason', sourceReason)); }
    detail.append(basis);
    if (explanation) { detail.append(diceSpan('xb-dice-coc7-reason', explanation)); }
    if (result.roll === 100) { detail.append(diceSpan('xb-dice-coc7-hundred', copy.hundred)); }
    hero.append(dice, verdict); element.append(heading, hero, detail);
    verdict.hidden = true; detail.hidden = true;
    return { element, rollingSlot: hero, tone,
        label: copy.accessible(name, outcome, result.roll, result.threshold, basisText, [sourceReason, explanation].filter(Boolean).join('；')),
        settle() { tens.draw(1, true); units.draw(1, true); verdict.hidden = false; detail.hidden = false; },
        draw(progress: number) { tens.draw(progress); units.draw(progress); } };
}
