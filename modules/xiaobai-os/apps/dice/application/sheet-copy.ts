import { COC7_RESET_COST } from '../domain/coc7-reset.js';
export const COC7_SHEET_COPY = {
    insufficientFunds: `小白币不足，重置需要 ${COC7_RESET_COST} 小白币。原属性未改变。`,
    saveUnconfirmed: '还不确定属性与账目是否保存成功，请先检查保存。',
    operationExpired: '原操作的条件已失效，未重新提交。请在钱包中使用已保存账本，再重新操作。',
    resetTransactionTitle: '重置人物属性',
    checkSave: '检查保存',
} as const;
