import type { Definition, Rule } from '../types.js';
import { overlaps, equal } from './data.js';
import { readsOf } from './expressions.js';
import { reject } from './diagnostics.js';

export function orderRules(definition: Definition): Rule[] {
    const rules = definition.rules;
    for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
            if (overlaps(rules[i].path, rules[j].path)) {reject('rule-write-conflict', { rules: [rules[i].id, rules[j].id] });}
        }
    }
    const needs = new Map(rules.map(rule => {
        const reads = readsOf(rule.value, definition);
        if (rule.kind === 'derive' && reads.some(path => overlaps(path, rule.path))) {reject('dependency-cycle', { rules: [rule.id] });}
        return [rule, rules.filter(other => other !== rule && reads.some(path => overlaps(other.path, path)))];
    }));
    const result = [], pending = new Set(rules);
    while (pending.size) {
        const ready = [...pending].filter(rule => needs.get(rule)!.every(other => !pending.has(other)));
        if (!ready.length) {reject('dependency-cycle', { rules: [...pending].map(rule => rule.id) });}
        for (const rule of ready) { result.push(rule); pending.delete(rule); }
    }
    // A correction may read its own output (clamping), but cannot become an
    // implicit loop through a descendant or another writer.
    for (const rule of rules.filter(item => item.kind === 'correct')) {
        for (const read of readsOf(rule.value, definition)) {
            if (overlaps(read, rule.path) && !equal(read, rule.path)) {reject('correction-self-read', { rule: rule.id, path: read });}
        }
    }
    return result;
}
