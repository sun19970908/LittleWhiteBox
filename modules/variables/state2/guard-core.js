import { parsePath, formatPath, sameSegment, isArrayIndex } from './path.js';

let rulesTable = {};
let patterns = new Map();

export function getRulesSnapshot() {
    return { ...rulesTable };
}

export function replaceRules(rules) {
    rulesTable = {};
    patterns = new Map();
    for (const [path, rule] of Object.entries(rules || {})) setRule(path, rule);
}

export function getRuleNode(absPath) {
    return matchRuleWithWildcard(absPath);
}

export function setRule(path, rule) {
    const parts = parsePath(path, { pattern: true });
    const key = formatPath(parts);
    rulesTable[key] = { ...(rulesTable[key] || {}), ...rule };
    patterns.set(key, parts);
}

export function clearRule(path) {
    const key = formatPath(parsePath(path, { pattern: true }));
    delete rulesTable[key];
    patterns.delete(key);
}

export function clearAllRules() {
    rulesTable = {};
    patterns.clear();
}

export function getParentPath(absPath) {
    const parts = parsePath(absPath);
    if (parts.length <= 1) return '';
    return formatPath(parts.slice(0, -1));
}

/**
 * 通配符路径匹配
 * 例如：data.同行者.张三.HP 可以匹配 data.同行者.*.HP
 * 例如：data.背包.0.名称 可以匹配 data.背包.[*].名称
 */
function matchRuleWithWildcard(absPath) {
    const parts = parsePath(absPath);
    let best = null, bestScore = -1, bestOrder = '';
    for (const [key, pattern] of patterns) {
        if (pattern.length !== parts.length) continue;
        let score = 0, order = '', matches = true;
        for (let i = 0; i < pattern.length; i++) {
            const token = pattern[i];
            const rank = token?.wildcard === 'key' ? 1
                : token?.wildcard === 'index' ? (isArrayIndex(parts[i]) ? 2 : 0)
                    : sameSegment(token, parts[i]) ? 3 : 0;
            if (!rank) { matches = false; break; }
            score += rank; order += rank;
        }
        // Preserve the old specificity and left-to-right tie break, without joining segments.
        if (matches && (score > bestScore || (score === bestScore && order > bestOrder))) {
            best = rulesTable[key]; bestScore = score; bestOrder = order;
        }
    }
    return best;
}

function getValueType(v) {
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    return typeof v;
}

function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function normalizeChildPath(parentPath, childKey) {
    return [...parsePath(parentPath), childKey];
}

function valueAt(value, key) {
    if (!value || typeof value !== 'object') return undefined;
    return Object.hasOwn(value, key) ? value[key] : undefined;
}

function coerceType(node, payload) {
    if (!node?.typeLock) return { allow: true, value: payload };

    let finalPayload = payload;

    // 宽松：数字字符串 => 数字
    if (node.typeLock === 'number' && typeof payload === 'string') {
        if (/^-?\d+(?:\.\d+)?$/.test(payload.trim())) {
            finalPayload = Number(payload);
        }
    }

    const finalType = getValueType(finalPayload);
    if (node.typeLock !== finalType) {
        return { allow: false, reason: `类型不匹配，期望 ${node.typeLock}，实际 ${finalType}` };
    }

    return { allow: true, value: finalPayload };
}

function mergeNote(current, next) {
    if (!next) return current;
    if (!current) return next;
    return `${current}，${next}`;
}

function validateScalarConstraints(node, payload) {
    const num = Number(payload);

    // range 限制
    if (Number.isFinite(num) && (node?.min !== undefined || node?.max !== undefined)) {
        let v = num;
        const min = node?.min;
        const max = node?.max;

        if (min !== undefined) v = Math.max(v, min);
        if (max !== undefined) v = Math.min(v, max);

        const clamped = v !== num;
        return {
            allow: true,
            value: v,
            note: clamped ? `超出范围，已限制到 ${v}` : undefined,
        };
    }

    // enum 枚举（不自动修正，直接拒绝）
    if (node?.enum?.length) {
        const s = String(payload ?? '');
        if (!node.enum.includes(s)) {
            return { allow: false, reason: `枚举不匹配，允许：${node.enum.join(' / ')}` };
        }
    }

    return { allow: true, value: payload };
}

function validateSetSubtree(absPath, payload, currentValue) {
    const node = getRuleNode(absPath);
    const coerced = coerceType(node, payload);
    if (!coerced.allow) return coerced;

    let value = coerced.value;
    let note = coerced.note;

    if (node?.ro && safeJSONForCompare(value) !== safeJSONForCompare(currentValue)) {
        return { allow: false, reason: '只读字段' };
    }

    const constrained = validateScalarConstraints(node, value);
    if (!constrained.allow) return constrained;
    value = constrained.value;
    note = mergeNote(note, constrained.note);

    if (Array.isArray(value)) {
        const nextArray = [];
        for (let i = 0; i < value.length; i++) {
            const childPath = normalizeChildPath(absPath, i);
            const result = validateSetSubtree(childPath, value[i], valueAt(currentValue, i));
            if (!result.allow) return result;
            nextArray.push(result.value);
            note = mergeNote(note, result.note);
        }
        return { allow: true, value: nextArray, note };
    }

    if (isPlainObject(value)) {
        const nextObject = {};
        const keys = Object.keys(value);

        if (node?.allowedKeys && Array.isArray(node.allowedKeys)) {
            for (const key of keys) {
                if (!node.allowedKeys.includes(key)) {
                    return { allow: false, reason: '字段不在结构模板中' };
                }
            }
            for (const key of node.allowedKeys) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) {
                    return { allow: false, reason: `缺少模板字段：${key}` };
                }
            }
        } else if (node && node.typeLock === 'object' && !node.objectExt && !node.allowedKeys && !node.hasWildcard) {
            const cur = isPlainObject(currentValue) ? currentValue : {};
            for (const key of keys) {
                if (!Object.prototype.hasOwnProperty.call(cur, key)) {
                    return { allow: false, reason: '父层结构已锁定，不允许新增字段' };
                }
            }
        }

        for (const key of keys) {
            const childPath = normalizeChildPath(absPath, key);
            const result = validateSetSubtree(childPath, value[key], valueAt(currentValue, key));
            if (!result.allow) return result;
            nextObject[key] = result.value;
            note = mergeNote(note, result.note);
        }
        return { allow: true, value: nextObject, note };
    }

    return { allow: true, value, note };
}

function validatePushSubtree(absPath, payload, currentValue) {
    const start = Array.isArray(currentValue) ? currentValue.length : 0;
    const isBatch = Array.isArray(payload);
    const items = isBatch ? payload : [payload];
    const nextItems = [];
    let note;

    for (let i = 0; i < items.length; i++) {
        const childPath = normalizeChildPath(absPath, start + i);
        const result = validateSetSubtree(childPath, items[i], undefined);
        if (!result.allow) return result;
        nextItems.push(result.value);
        note = mergeNote(note, result.note);
    }

    return {
        allow: true,
        value: isBatch ? nextItems : nextItems[0],
        note,
    };
}

function safeJSONForCompare(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(value, (_key, item) => {
            if (typeof item === 'bigint') {
                return `BigInt:${String(item)}`;
            }
            if (item && typeof item === 'object') {
                if (seen.has(item)) return '[Circular]';
                seen.add(item);
            }
            return item;
        });
    } catch {
        return String(value);
    }
}

/**
 * 验证操作
 * @returns {{ allow: boolean, value?: any, reason?: string, note?: string }}
 */
export function validate(op, absPath, payload, currentValue) {
    absPath = parsePath(absPath);
    const node = getRuleNode(absPath);
    const parentNode = absPath.length > 1 ? getRuleNode(absPath.slice(0, -1)) : null;
    const isNewKey = currentValue === undefined;

    const lastSeg = String(absPath.at(-1));

    // ===== 1. $schema 白名单检查 =====
    if (parentNode?.allowedKeys && Array.isArray(parentNode.allowedKeys)) {
        if (isNewKey && (op === 'set' || op === 'push')) {
            if (!parentNode.allowedKeys.includes(lastSeg)) {
                return { allow: false, reason: '字段不在结构模板中' };
            }
        }
        if (op === 'del') {
            if (parentNode.allowedKeys.includes(lastSeg)) {
                return { allow: false, reason: '模板定义的字段不能删除' };
            }
        }
    }

    // ===== 2. 父层结构锁定（无 objectExt / 无 allowedKeys / 无 hasWildcard） =====
    if (parentNode && parentNode.typeLock === 'object') {
        if (!parentNode.objectExt && !parentNode.allowedKeys && !parentNode.hasWildcard) {
            if (isNewKey && (op === 'set' || op === 'push')) {
                return { allow: false, reason: '父层结构已锁定，不允许新增字段' };
            }
        }
    }

    // ===== 3. $ro 只读：直接 set 只读路径保持旧行为，无条件拒绝 =====
    if (node?.ro && op === 'set') {
        return { allow: false, reason: '只读字段' };
    }

    // ===== 4. 类型锁定 / set 子树深度校验 =====
    if (op === 'set') {
        return validateSetSubtree(absPath, payload, currentValue);
    }

    // ===== 5. 数组扩展检查 / push 元素深度校验 =====
    if (op === 'push') {
        if (node?.typeLock && node.typeLock !== 'array') {
            return { allow: false, reason: `类型不匹配，期望 array，实际 ${node.typeLock}` };
        }
        if (node && node.typeLock === 'array' && !node.arrayGrow) {
            return { allow: false, reason: '数组不允许扩展' };
        }
        return validatePushSubtree(absPath, payload, currentValue);
    }

    // ===== 6. $ro 只读 =====
    if (node?.ro && op === 'inc') {
        return { allow: false, reason: '只读字段' };
    }

    // ===== 7. inc 操作：step / range 限制 =====
    if (op === 'inc') {
        const delta = Number(payload);
        if (!Number.isFinite(delta)) return { allow: false, reason: 'delta 不是数字' };

        const cur = Number(currentValue) || 0;
        let d = delta;
        const noteParts = [];

        // step 限制
        if (node?.step !== undefined && node.step >= 0) {
            const before = d;
            if (d > node.step) d = node.step;
            if (d < -node.step) d = -node.step;
            if (d !== before) {
                noteParts.push(`超出步长限制，已限制到 ${d >= 0 ? '+' : ''}${d}`);
            }
        }

        let next = cur + d;

        // range 限制
        const beforeClamp = next;
        if (node?.min !== undefined) next = Math.max(next, node.min);
        if (node?.max !== undefined) next = Math.min(next, node.max);
        if (next !== beforeClamp) {
            noteParts.push(`超出范围，已限制到 ${next}`);
        }

        return {
            allow: true,
            value: next,
            note: noteParts.length ? noteParts.join('，') : undefined,
        };
    }

    return { allow: true, value: payload };
}
