import type { DiceContinuationProgress, DiceContinuationStage, DiceHostBlocker, DiceHostWait } from '../application/host-wait.js';

const blockerLabels: Record<DiceHostBlocker, string> = {
    generation: '酒馆开放继续生成',
};

const continuationLabels: Record<DiceContinuationStage, string> = {
    preparing: '酒馆正在准备续写',
    requesting: '等待 AI 续写响应',
    responding: 'AI 已响应，等待续写正文',
};

const withElapsed = (label: string, seconds: number) => `${label} · 已等 ${seconds} 秒`;

export const DICE_SESSION_COPY = {
    waitingGroup: '等待群聊轮次交接…',
    waitingHost: '准备行动检定…',
    unrolled: '检定请求已保留，尚未掷骰。',
    paused: '已暂停等待，尚未掷骰。',
    retained: '已暂停等待，骰点已保留。',
    retryCheck: '重试检定',
    retryContinue: '沿用骰点续写',
    continuing: continuationLabels.preparing,
    retryFailed: '暂时无法重试。请等酒馆生成结束；若已修改回复，请用酒馆的「继续」。',
} as const;

export function diceHostWaitLabel(wait: DiceHostWait): string {
    return withElapsed(`等待${wait.blockers.map(blocker => blockerLabels[blocker]).join('、')}`, wait.elapsedSeconds);
}

export function diceContinuationLabel(progress: DiceContinuationProgress): string {
    return withElapsed(continuationLabels[progress.stage], progress.elapsedSeconds);
}
