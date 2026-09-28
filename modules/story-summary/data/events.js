export const EVENT_MEMORY_ROLES = Object.freeze([
    '状态变化',
    '约定承诺',
    '信息揭示',
    '偏好习惯',
    '具体经历',
]);

const EVENT_FIELDS = ['id', 'title', 'timeLabel', 'summary', 'participants', 'causedBy', '_addedAt'];

/** Canonical participants/cause lists at both write and stored-data boundaries. */
export function normalizeEventStringArray(value) {
    if (!Array.isArray(value)) {
        return { value: [], changed: value != null };
    }

    const next = [];
    let changed = false;
    for (const item of value) {
        let text = '';
        if (typeof item === 'string') {
            text = item.trim();
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
            // Stored summaries may contain lightweight name/id objects. Writers validate string arrays first.
            text = String(item.name || item.text || item.id || '').trim();
            changed = true;
        } else if (item != null) {
            changed = true;
        }
        if (!text) {
            if (item != null) changed = true;
            continue;
        }
        next.push(text);
        if (typeof item !== 'string' || item !== text) {
            changed = true;
        }
    }

    if (!changed && next.length !== value.length) {
        changed = true;
    }

    return { value: changed ? next : value, changed };
}

export function normalizeEventMemoryRole(value) {
    const role = typeof value === 'string' ? value.trim() : '';
    return EVENT_MEMORY_ROLES.includes(role) ? role : '';
}

/** Current event projection at generation, editing and stored-data boundaries. */
export function projectSummaryEvent(event) {
    const result = {};
    for (const field of EVENT_FIELDS) {
        if (Object.hasOwn(event, field)) result[field] = event[field];
    }
    result.memoryRole = normalizeEventMemoryRole(event.memoryRole);
    return result;
}

/** Project a complete edited collection and keep causal references within it. */
export function projectEditedSummaryEvents(events) {
    const eventIds = new Set(events.map(event => event.id));
    return events.map(event => {
        const projected = projectSummaryEvent(event);
        if (Array.isArray(projected.causedBy)) {
            projected.causedBy = projected.causedBy.filter(id => eventIds.has(id));
        }
        return projected;
    });
}
