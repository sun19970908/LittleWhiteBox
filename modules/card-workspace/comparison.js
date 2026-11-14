import { ITEM_KINDS, parseItemDocument } from './item-document.js';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export const equalJson = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export function equalText(left, right, settings = false) {
    if (left == null || right == null) return left === right;
    if (ITEM_KINDS[settings]) {
        const normalize = content => {
            const value = parseItemDocument(settings, content);
            return { ...value, body: value.body.replace(/\r\n/g, '\n') };
        };
        return equalJson(normalize(left), normalize(right));
    }
    return settings ? equalJson(JSON.parse(left), JSON.parse(right)) : left.replace(/\r\n/g, '\n') === right.replace(/\r\n/g, '\n');
}
