const messages = {
    dice_target_changed: '原回复已变更，未执行操作。',
    dice_busy: '请等待当前操作结束。',
    dice_disabled: '请先开启行动检定。',
    dice_insufficient_funds: '小白币不足。',
    dice_continue_failed: '骰点已保留，暂时无法续写。',
    dice_check_failed: '本次未完成行动检定。',
    dice_results_unavailable: '暂时无法读取骰点。',
    dice_result_save_failed: '本次骰点未能确认保存，请勿立即刷新。',
} as const;

export type DiceOperationCode = keyof typeof messages;
export class DiceOperationError extends Error {
    constructor(readonly code: DiceOperationCode, options?: ErrorOptions) { super(messages[code], options); }
}
