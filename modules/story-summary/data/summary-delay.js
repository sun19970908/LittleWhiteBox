export const DEFAULT_SUMMARY_DELAY_FLOORS = 2;

export function normalizeSummaryDelayFloors(value) {
    const floors = Number.parseInt(value, 10);
    return Number.isFinite(floors)
        ? Math.max(0, Math.min(30, floors))
        : DEFAULT_SUMMARY_DELAY_FLOORS;
}
