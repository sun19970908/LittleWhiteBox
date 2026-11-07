import type { Bundle, Json, Result, RunOptions } from '../types.js';
import type { SettlementService } from './service.js';
import type { openDraft, saveDraft, checkDraft, saveCardDraft } from '../definition/authoring.js';
import type { readSettings, saveSettings } from './settings.js';
import type { createState3Updater } from '../model/updater.js';

export interface State3Api {
    stage: SettlementService['stage']; apply: SettlementService['apply']; preview: SettlementService['preview'];
    undo: SettlementService['undo']; inspect: SettlementService['inspect'];
    enable(options?: RunOptions): Promise<Result>;
    upgrade(options?: RunOptions & { preview?: boolean }): Promise<Result>;
    tryDefinition(bundle: Bundle, input?: unknown, options?: RunOptions & { state?: Json }): Promise<Result>;
    openDraft: typeof openDraft; saveDraft: typeof saveDraft; checkDraft: typeof checkDraft; saveCardDraft: typeof saveCardDraft;
    lastResult(): Result | undefined;
    retrySave(): Promise<{ ok: true; saved: true }>;
    settings: typeof readSettings; saveSettings: typeof saveSettings;
    update(): Promise<Result>;
    previewRequest: ReturnType<typeof createState3Updater>['previewRequest'];
    cancel(): void;
    updateStatus: ReturnType<typeof createState3Updater>['status'];
    openAssistant(): Promise<void>;
}
declare global { interface Window { LWB_StateV3?: State3Api } }
