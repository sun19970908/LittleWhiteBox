import type { Bundle, Json, Result, RunOptions } from '../types.js';
import type { SettlementService } from './service.js';
import type { openDraft, saveDraft, checkDraft, saveCardDraft, exportRules, prepareRuleImport, importRules } from '../definition/authoring.js';
import type { readSettings, saveSettings } from './settings.js';
import type { createState3Updater } from '../model/updater.js';
import type { ExtensionTest, ExtensionTestResult } from '../extensions/testing.js';
import type { RefreshOptions, RefreshResult } from '../definition/refresh.js';

export interface State3Api {
    stage: SettlementService['stage']; apply: SettlementService['apply']; preview: SettlementService['preview'];
    undo: SettlementService['undo']; inspect: SettlementService['inspect'];
    enable(options?: RunOptions): Promise<Result>;
    tryDefinition(bundle: Bundle, input?: unknown, options?: RunOptions & { state?: Json; opening?: number }): Promise<Result>;
    openDraft: typeof openDraft; saveDraft: typeof saveDraft; checkDraft: typeof checkDraft; saveCardDraft: typeof saveCardDraft;
    exportRules: typeof exportRules; prepareRuleImport: typeof prepareRuleImport; importRules: typeof importRules;
    refreshRules(options: RefreshOptions): Promise<RefreshResult>;
    lastResult(): Result | undefined;
    retrySave(): Promise<{ ok: true; saved: true }>;
    settings: typeof readSettings; saveSettings: typeof saveSettings;
    update(): Promise<Result>;
    recomputeBefore(index: number): Promise<Result | undefined>;
    skipBefore(index: number): Promise<Result>;
    undoBefore(index: number): Promise<Result>;
    previewRequest: ReturnType<typeof createState3Updater>['previewRequest'];
    cancel(): void;
    updateStatus: ReturnType<typeof createState3Updater>['status'];
    testExtension(draft: DraftForTest, test: ExtensionTest, options?: RunOptions): Promise<ExtensionTestResult>;
    revokeExtensionTrust(): void;
    extensionTrust(): 'unused' | 'allowed' | 'required';
    authorizeExtensions(options?: RunOptions): Promise<void>;
    openAssistant(options?: { path?: string; message?: string; context?: string; reveal?: boolean }): Promise<void>;
}
type DraftForTest = Awaited<ReturnType<typeof openDraft>>;
declare global { interface Window { LWB_StateV3?: State3Api } }
