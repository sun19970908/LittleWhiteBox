import type { ActionCheckRecord } from '../domain/check-records.js';
import { createD20Result } from './d20-result.js';
import { createCoc7Result } from './coc7-result.js';
import { diceSpan } from './card-elements.js';
import { createCardTexture } from './card-texture.js';

/** A saved check's view. It never rolls, saves, or starts generation. */
export function createCheckCard(record: ActionCheckRecord, pending: boolean) {
    const element = diceSpan('xb-dice-card');
    // ST's streaming fade-in uses morphdom's ID keys. Without a key it can turn this
    // retained span into an ordinary text segment, destroying the cached component.
    element.id = `xb-dice-check-${record.id}`;
    element.dataset.diceRecord = record.id;
    element.dataset.rule = record.rule;
    element.setAttribute('role', 'group');
    const result = record.rule === 'coc7' ? createCoc7Result(record) : createD20Result(record);
    const name = record.rule === 'coc7' ? record.request.stat : [record.request.character, record.request.stat].filter(Boolean).join(' · ');
    const identity = diceSpan('xb-dice-identity', name);
    identity.hidden = record.rule === 'coc7';
    const rolling = diceSpan('xb-dice-rolling-label', '正在掷骰');
    result.rollingSlot.append(rolling);
    const copy = diceSpan('xb-dice-copy');
    copy.append(diceSpan('xb-dice-action', record.request.action));
    if (record.rule === 'd20' && record.request.stakes) {
        const text = diceSpan('xb-dice-stakes-text', record.request.stakes);
        if (record.request.stakes.length > 96) {
            const details = document.createElement('details'); details.className = 'xb-dice-stakes';
            const summary = document.createElement('summary'); summary.textContent = '风险与后果';
            details.append(summary, text); copy.append(details);
        } else {
            const stakes = diceSpan('xb-dice-stakes');
            stakes.append(diceSpan('xb-dice-stakes-label', '风险'), text); copy.append(stakes);
        }
    }
    const status = diceSpan('xb-dice-status'); status.hidden = true;
    status.setAttribute('role', 'status');
    element.append(createCardTexture(), identity, result.element, copy, status);
    function settle(): void {
        if (element.dataset.state === 'settled') { return; }
        if (element.dataset.state === 'rolling') { element.dataset.revealed = 'true'; }
        element.dataset.state = 'settled'; element.dataset.outcome = result.tone;
        if (record.rule === 'coc7') { element.dataset.verdict = record.result.verdict; }
        identity.hidden = record.rule === 'coc7';
        element.setAttribute('aria-label', record.rule === 'coc7' ? result.label : `${name}检定：${result.label}`);
        copy.hidden = false; rolling.hidden = true;
        result.settle();
    }
    if (pending) {
        element.dataset.state = 'rolling';
        element.setAttribute('aria-label', `${name}检定，正在掷骰`);
        copy.hidden = true;
        result.draw(0);
    } else { settle(); }
    return { element, status, settle, draw: result.draw };
}

export type CheckCard = ReturnType<typeof createCheckCard>;
