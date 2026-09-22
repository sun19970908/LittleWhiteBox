export type DiceHostBlocker = 'generation';

/** A transient observation of the host, not a prediction of its completion time. */
export interface DiceHostWait {
    blockers: DiceHostBlocker[];
    elapsedSeconds: number;
}

export type DiceContinuationStage = 'preparing' | 'requesting' | 'responding';

/** Observed native generation progress; elapsed time is not a completion estimate. */
export interface DiceContinuationProgress {
    stage: DiceContinuationStage;
    elapsedSeconds: number;
}

export class DiceHostWaitTimeout extends Error {
    constructor(readonly wait: DiceHostWait) {
        super('dice_host_wait_timeout');
        this.name = 'DiceHostWaitTimeout';
    }
}
