// Each pool admits its boundary item whole, then closes. Shared ledgers prevent
// later admission phases from claiming another overflow item. Nested quotas
// charge the same item atomically; a closed quota never consumes another pool.
export function tryConsumeWholeItem(cost, ...budgets) {
    if (budgets.some(budget => budget.used >= budget.max)) return false;
    for (const budget of budgets) budget.used += cost;
    return true;
}
