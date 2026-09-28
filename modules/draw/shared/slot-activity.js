// DOM leases observe operations; they do not own or cancel them.
const activities = new Map();

export function getSlotActivity(slotId) {
    return activities.get(slotId) || null;
}

export function setSlotActivity(slotId, activity) {
    activities.set(slotId, activity);
}

export function clearSlotActivity(slotId, owner) {
    if (activities.get(slotId)?.owner === owner) activities.delete(slotId);
}
