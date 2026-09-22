import type { XiaobaiOsSettingsRepository } from '../../../host/settings-repository.js';
import type { XiaobaiOsAppActivationContext, XiaobaiOsAppRuntime } from '../../../types.js';
import type { DiceClientState, DiceFeature } from '../types.js';
import { isActionCheckFrequency, isActionCheckRule } from '../settings.js';
import { parseCoc7Sheet, readCoc7Sheet } from '../domain/coc7-sheet.js';
import type { DiceSheetService } from '../application/sheet-service.js';

export function createDiceController(settings: Pick<XiaobaiOsSettingsRepository, 'read' | 'subscribe' | 'setDiceFeature' | 'setDiceActionCheckFrequency' | 'setDiceActionCheckRule'>,
    getChatIdentity: () => string, ensureDisplay: () => Promise<void>,
    cancel: (feature: DiceFeature) => void, sheets: DiceSheetService): XiaobaiOsAppRuntime & { disable(): Promise<void> } {
    let activation: XiaobaiOsAppActivationContext | null = null;
    const state = (): DiceClientState => {
        const preferences = settings.read()!.apps.dice;
        return { chatIdentity: getChatIdentity(), ...preferences, coc7Sheet: readCoc7Sheet(sheets.read()), sheetStorage: sheets.getFileState() };
    };
    const emit = () => activation?.post('dice/state', { state: state() });
    let unsubscribe: (() => void) | null = null;
    let unsubscribeSheets: (() => void) | null = null;

    async function savePreference(save: () => Promise<unknown>): Promise<void> {
        try { await save(); }
        catch (error) {
            console.error('[LittleWhiteBox] Dice settings save failed', error);
            throw new Error('设置未能保存，请重试。');
        }
    }

    async function setEnabled(feature: DiceFeature, enabled: boolean, guard = () => true): Promise<void> {
        if (enabled && feature === 'actionChecksEnabled') {
            try { await ensureDisplay(); }
            catch (error) {
                console.error('[LittleWhiteBox] Dice display setup failed', error);
                throw new Error('行动检定暂时无法开启，请检查酒馆的正则扩展。');
            }
        }
        if (!guard()) { throw new Error('聊天或页面已切换。'); }
        await savePreference(() => settings.setDiceFeature(feature, enabled));
        // A global preference also applies if the chat changes during its save.
        if (!enabled && !unsubscribe) { cancel(feature); }
        if (!guard()) { throw new Error('聊天或页面已切换。'); }
        emit();
    }

    return {
        async activate(context) { await sheets.refresh(); activation = context; return state(); },
        deactivate() { activation = null; },
        cancelForeground() { activation = null; },
        startBackground() {
            if (unsubscribe) { return; }
            unsubscribeSheets = sheets.subscribe(emit);
            let previous = settings.read()!.apps.dice;
            unsubscribe = settings.subscribe(next => {
                for (const feature of ['actionChecksEnabled', 'encountersEnabled'] as const) {
                    if (previous[feature] && !next.apps.dice[feature]) { cancel(feature); }
                }
                previous = next.apps.dice;
                emit();
            });
        },
        stopBackground() { unsubscribe?.(); unsubscribeSheets?.(); unsubscribe = null; unsubscribeSheets = null; activation = null; cancel('actionChecksEnabled'); cancel('encountersEnabled'); },
        async handleMessage(message) {
            const payload = message.payload as { chatIdentity?: string; feature?: string; enabled?: boolean; frequency?: unknown; rule?: unknown; sheet?: unknown } | undefined;
            const owner = activation;
            if (!owner?.isCurrent() || payload?.chatIdentity !== state().chatIdentity) { throw new Error('聊天或页面已切换。'); }
            if (message.type === 'dice/set-feature') {
                if (typeof payload?.enabled !== 'boolean' || !['actionChecksEnabled', 'encountersEnabled'].includes(payload.feature ?? '')) { throw new Error('开关值无效。'); }
                await setEnabled(payload.feature as DiceFeature, payload.enabled,
                    () => activation === owner && owner.isCurrent() && payload.chatIdentity === getChatIdentity());
            } else if (message.type === 'dice/set-rule') {
                const rule = payload?.rule;
                if (!isActionCheckRule(rule)) { throw new Error('检定规则无效。'); }
                await savePreference(() => settings.setDiceActionCheckRule(rule));
                if (activation !== owner || !owner.isCurrent() || payload.chatIdentity !== getChatIdentity()) {
                    throw new Error('聊天或页面已切换。');
                }
                emit();
            } else if (message.type === 'dice/set-coc7-sheet') {
                const sheet = payload?.sheet === null ? null : parseCoc7Sheet(payload?.sheet);
                try { await sheets.save(sheet, () => activation === owner && owner.isCurrent()); }
                finally { emit(); }
                if (activation !== owner || !owner.isCurrent() || payload?.chatIdentity !== getChatIdentity()) {
                    throw new Error('聊天或页面已切换。');
                }
                emit();
            } else if (message.type === 'dice/confirm-sheet-save') {
                await sheets.confirm(); emit();
            } else if (message.type === 'dice/set-frequency') {
                const frequency = payload?.frequency;
                if (!isActionCheckFrequency(frequency)) { throw new Error('检定频率无效。'); }
                await savePreference(() => settings.setDiceActionCheckFrequency(frequency));
                if (activation !== owner || !owner.isCurrent() || payload?.chatIdentity !== getChatIdentity()) {
                    throw new Error('聊天或页面已切换。');
                }
                emit();
            } else { throw new Error('未知的 Dice 操作。'); }
            return state();
        },
        async disable() { await setEnabled('actionChecksEnabled', false); await setEnabled('encountersEnabled', false); },
    };
}
