import { createFixture, verifyScopedSave } from './journey.browser.js';
import { equipmentExample } from '../definition/example.js';
import type { State3Api } from '../runtime/api.js';
import type { Context, ChatMessage } from '../runtime/host.js';
import type { JsonObject, Result, SwipeRecord } from '../types.js';

const ctx = () => (window as unknown as { SillyTavern: { getContext(): Context } }).SillyTavern.getContext();
const check = (condition: unknown, label: string) => { if (!condition) {throw new Error(label);} };
const accepted = <T extends Result>(result: T): Extract<T, { ok: true }> => {
    if (!result.ok) {throw new Error(JSON.stringify(result.diagnostics));} return result as Extract<T, { ok: true }>;
};
const restored = (api: State3Api) => { const result = api.lastResult(); return result?.ok ? result.restoration : undefined; };
async function hostModules() {
    const hostUrl = '/script.js', constantsUrl = '/scripts/constants.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URLs in an isolated acceptance instance.
    const host = await import(/* @vite-ignore */ hostUrl);
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const constants = await import(/* @vite-ignore */ constantsUrl);
    const choose = (index: number, swipeId: number) => host.swipe(null, swipeId ? constants.SWIPE_DIRECTION.RIGHT : constants.SWIPE_DIRECTION.LEFT,
        { source: constants.SWIPE_SOURCE.SWIPE_PICKER, forceMesId: index, forceSwipeId: swipeId, forceDuration: 0 });
    return { host, choose };
}
async function waitFor(ready: () => boolean) {
    for (let count = 0; count < 200; count++) {
        if (ready()) {return;} await new Promise<void>(resolve => setTimeout(resolve, 50));
    }
    throw new Error('restoration feedback did not complete');
}

/** R3: prepare real data, then the caller clicks the native edit/copy buttons. */
export async function prepareCopy(api: State3Api) {
    const fixture = await createFixture(); await verifyScopedSave(api, equipmentExample()); accepted(await api.enable());
    accepted(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    const { host } = await hostModules(), message = ctx().chat[0];
    host.ensureSwipes(message); host.syncMesToSwipe(0);
    message.swipes!.push('另一条回复'); message.swipe_info!.push(structuredClone(message.swipe_info![0]));
    message.extra!.neighbor = { keep: 'copy-neighbor' };
    await ctx().saveChat();
    return { ...fixture, health: 20, originalReceipt: (message.extra!['lwb-state3'] as SwipeRecord).entries[0].id };
}

/** R3: the host's copy save must already contain the clean copy; do not save before reading it back. */
export async function verifyCopySaved(api: State3Api) {
    check(ctx().chat.length === 2, 'native copy did not create one message');
    const [original, copy] = ctx().chat;
    const originalEntries = structuredClone(original.extra!['lwb-state3']);
    check(Boolean(originalEntries), 'original lost its receipt while reopening');
    const clean = (message: ChatMessage) => [message, ...(message.swipe_info || [])].every(holder => !holder.extra?.['lwb-state3']);
    check(clean(copy), 'copy kept settlement ownership');
    check((copy.extra!.neighbor as { keep: string }).keep === 'copy-neighbor', 'other extension data was removed');
    const { host } = await hostModules(); await host.reloadCurrentChat();
    check(clean(ctx().chat[1]), 'host saved copied receipts before cleanup');
    check(JSON.stringify(ctx().chat[0].extra!['lwb-state3']) === JSON.stringify(originalEntries), 'original receipt changed');
    await host.deleteLastMessage();
    check((accepted(await api.inspect()).state as { hero: { health: number } }).hero.health === 20, 'deleting copy undid original');
    await host.reloadCurrentChat();
    check((accepted(await api.inspect()).state as { hero: { health: number } }).hero.health === 20, 'deleting copy corrupted saved values');
    const originalMessage = ctx().chat[0];
    originalMessage.swipes!.push('没有受伤'); originalMessage.swipe_info!.push({ extra: {} });
    const { choose } = await hostModules(); await choose(0, 2);
    await waitFor(() => Boolean(restored(api)));
    const result = accepted(api.lastResult()!);
    check(result.changes.some(change => change.path.at(-1) === 'health' && change.before === 20 && change.after === 80), 'UI result lost actual recovery change');
    return { copiedHoldersClean: true, otherExtensionPreserved: true, originalHealthAfterDelete: 20, restored: result.changes };
}

/** R1/R2: native historical swipe, schema/constraint warnings, and a repair without a conflict gate. */
export async function prepareConflict(api: State3Api) {
    const bundle = equipmentExample();
    bundle.definition = { ...bundle.definition, schema: {}, initial: { 钥匙: '无', 门: '未打开', 奖励次数: 0 },
        access: [{ path: ['钥匙'], direct: true, description: '钥匙' }, { path: ['门'], direct: true, description: '门' }],
        rules: [], actions: [], triggers: [], views: {}, constraints: [{ id: 'door-key', description: '开门必须持有钥匙',
            test: { op: 'or', args: [{ op: 'eq', args: [{ get: ['门'] }, { literal: '未打开' }] }, { op: 'eq', args: [{ get: ['钥匙'] }, { literal: '有' }] }] } }] };
    const fixture = await createFixture(); await verifyScopedSave(api, bundle); accepted(await api.enable());
    accepted(await api.apply([{ op: 'set', path: ['钥匙'], value: '有' }]));
    const { host, choose } = await hostModules(), message = ctx().chat[0];
    host.ensureSwipes(message); host.syncMesToSwipe(0);
    message.swipes!.push('没有拿到钥匙'); message.swipe_info!.push({ extra: {} });
    const later: ChatMessage = { name: fixture.name, mes: '用钥匙打开了门。', is_user: false, extra: {}, send_date: String(Date.now()) };
    ctx().chat.push(later); host.addOneMessage(later);
    accepted(await api.apply([{ op: 'set', path: ['门'], value: '已打开' }]));
    // A newly authored correction and reward must not execute during the swipe.
    bundle.definition.rules = [{ id: 'repair', kind: 'correct', path: ['钥匙'], description: '测试修正', value: { literal: '有' } }];
    bundle.definition.triggers = [{ id: 'reward', description: '测试奖励', when: { literal: true }, effects: [{ path: ['奖励次数'], value: { literal: 1 } }] }];
    const draft = await api.openDraft();
    await api.saveDraft(draft, [{ path: draft.root + 'variables/definition.json', content: JSON.stringify(bundle.definition) }]);
    const saved = await api.saveCardDraft(await api.openDraft()); check('ok' in saved && saved.ok, 'rule update failed');
    await choose(0, 1);
    await waitFor(() => Boolean(restored(api)?.length));
    const result = accepted(api.lastResult()!);
    check(JSON.stringify(result.state) === JSON.stringify({ 钥匙: '无', 门: '已打开', 奖励次数: 0 }), 'restoration executed a correction or reward');
    check(result.restoration?.[0].rule === 'door-key', 'historical conflict not reported');
    check(document.querySelector('.mes[mesid="0"] [role="alert"]'), 'conflict is not visible on the changed reply');
    return { fixture, state: result.state, diagnostics: result.restoration };
}

export async function verifyConflictRepair(api: State3Api) {
    const { host, choose } = await hostModules();
    const status = accepted(await api.inspect()), bundle = structuredClone(status.bundle);
    bundle.definition.rules = []; bundle.definition.triggers = [];
    const draft = await api.openDraft();
    await api.saveDraft(draft, [{ path: draft.root + 'variables/definition.json', content: JSON.stringify(bundle.definition) }]);
    const saved = await api.saveCardDraft(await api.openDraft()); check('ok' in saved && saved.ok, 'rule save failed');
    const state = JSON.stringify(status.state), revision = (ctx().chatMetadata['lwb-state3'] as { revision: number }).revision;
    ctx().chat[0].is_system = true;
    await host.eventSource.emit(host.event_types.MESSAGE_EDITED, 0);
    check(JSON.stringify(accepted(await api.inspect()).state) === state && (ctx().chatMetadata['lwb-state3'] as { revision: number }).revision === revision, 'hiding/editing reran state');
    ctx().chat[0].is_system = false;
    await choose(0, 0);
    await waitFor(() => Boolean(restored(api)));
    check(!accepted(api.lastResult()!).restoration?.length && !document.querySelector('[role="alert"]'), 'valid selection did not clear warning');
    await choose(0, 1); await waitFor(() => Boolean(restored(api)?.length));
    check(!(await api.apply([])).ok, 'invalid update accepted');
    accepted(await api.apply([{ op: 'set', path: ['钥匙'], value: '有' }]));
    await host.reloadCurrentChat();
    const repaired = accepted(await api.inspect()).state as JsonObject;
    check(repaired.钥匙 === '有' && repaired.门 === '已打开' && repaired.奖励次数 === 0, 'repair not persisted');
    return { validSelectionSilent: true, hiddenDidNotRecalculate: true, repaired };
}
