import type { WalletTransactionView } from '../types.js';

export function walletAmount(transaction: WalletTransactionView): string {
    const sign = transaction.direction === 'income' ? '+' : transaction.direction === 'expense' ? '−' : '';
    return `${sign}${transaction.amount.toLocaleString('zh-CN')}`;
}

export const walletDirection = { income: '收入', expense: '支出', transfer: '系统划转' } as const;

export function walletTransactionIcon(transaction: WalletTransactionView): string {
    return ({ economy: 'gift', bank: 'bank', shop: 'shop', tasks: 'tasks', game: 'game' } as Record<string, string>)[transaction.sourceDomain] || transaction.direction;
}
