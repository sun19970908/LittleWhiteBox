import type { State3Api } from '../runtime/api.js';
import type { Bundle, Json, Success } from '../types.js';
import type { Context, ChatMessage } from '../runtime/host.js';
import type { AgentChatInput, AgentChatResult } from '../../../agent-core/public-api.js';

interface TestContext extends Context { getRequestHeaders(options?: { omitContentType: boolean }): Record<string, string>; openCharacterChat(name: string): Promise<void>; substituteParams(text: string): string }
interface Host {
    Generate(type: string): Promise<void>; online_status: string; setOnlineStatus(value: string): void;
    getCharacters(): Promise<void>; selectCharacterById(id: number): Promise<void>;
    ensureSwipes(message: ChatMessage): void; syncMesToSwipe(index: number): void;
    swipe(event: null, direction: unknown, options: object): Promise<void>; deleteSwipe(swipe: number, index: number): Promise<void>;
    deleteMessage(index: number): Promise<void>; deleteLastMessage(): Promise<void>;
    addOneMessage(message: ChatMessage, options?: object): void; reloadCurrentChat(): Promise<void>;
    eventSource: { emit(event: string, ...args: unknown[]): Promise<void> }; event_types: Record<string, string>;
}
const getContext = () => (window as unknown as { SillyTavern: { getContext(): TestContext } }).SillyTavern.getContext();
const accepted = (result: Awaited<ReturnType<State3Api['apply']>>): Success => {
    if (!result.ok) { throw new Error(JSON.stringify(result.diagnostics)); }
    return result;
};
const requireValue = (condition: boolean, name: string) => { if (!condition) { throw new Error(name); } };
async function loadHost() {
    const url = '/script.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL, not user or model input.
    return await import(/* @vite-ignore */ url) as Host;
}

/** Fixture setup uses the actual isolated server and card workspace. No feature source imports. */
export async function createFixture() {
    const host = await loadHost(), ctx = getContext(), name = 'state3-final-' + Date.now();
    const form = new FormData(); form.set('ch_name', name); form.set('file_name', name);
    form.set('first_mes', '艾琳摘下护符，放进背包。'); form.set('description', 'Variable 3 isolated acceptance');
    const response = await fetch('/api/characters/create', { method: 'POST', headers: ctx.getRequestHeaders({ omitContentType: true }), body: form });
    if (!response.ok) { throw new Error('create:' + response.status); }
    const avatar = await response.text();
    await host.getCharacters();
    await host.selectCharacterById(getContext().characters.findIndex(card => card.avatar === avatar));
    return { avatar, name };
}

export async function verifyScopedSave(api: State3Api, bundle: Bundle) {
    const draft = await api.openDraft(), path = draft.root + 'variables/definition.json';
    const incomplete = await api.saveDraft(draft, [{ path, content: '{"name":"unfinished"}' }]);
    const saved = await api.saveCardDraft(incomplete);
    requireValue('ok' in saved && !saved.ok, 'K6: incomplete draft stays in workspace, not on the card');
    const updates = [{ path, content: JSON.stringify(bundle.definition) },
        ...Object.entries(bundle.functions).map(([id, content]) => ({ path: draft.root + 'variables/functions/' + id + '.js', content }))];
    const next = await api.saveDraft(await api.openDraft(), updates);
    const ctx = getContext(), avatar = ctx.characters[ctx.characterId].avatar;
    const marker = 'concurrent-' + Date.now();
    const external = await fetch('/api/characters/merge-attributes', { method: 'POST', headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ avatar, data: { extensions: { 'acceptance-neighbor': { marker } } } }) });
    requireValue(external.ok, 'fixture neighbor write');
    accepted(await api.checkDraft(next, []));
    const cardSave = await api.saveCardDraft(next);
    requireValue('ok' in cardSave && Boolean(cardSave.ok), 'K6: complete card saved');
    const response = await fetch('/api/characters/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ avatar_url: avatar }) });
    const card = await response.json() as { data: { extensions: Record<string, unknown> } };
    requireValue((card.data.extensions['acceptance-neighbor'] as { marker: string }).marker === marker, 'K6: unrelated concurrent extension preserved');
    requireValue(JSON.stringify(JSON.parse(card.data.extensions['lwb-state3'] as string)) === JSON.stringify(bundle), 'K6: whole bundle persisted');
    return { incompleteRejected: true, unrelatedPreserved: true, bundleSaved: true };
}

export async function verifySwipes(api: State3Api) {
    const host = await loadHost(), constantsUrl = '/scripts/constants.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL, not user or model input.
    const constants = await import(/* @vite-ignore */ constantsUrl) as { SWIPE_DIRECTION: { LEFT: unknown; RIGHT: unknown }; SWIPE_SOURCE: { SWIPE_PICKER: unknown } };
    const initial = accepted(await api.inspect()).state;
    const original = accepted(await api.apply([{ action: 'unequip', params: {} }])).state;
    const ctx = getContext(), index = ctx.chat.length - 1, message = ctx.chat[index];
    host.ensureSwipes(message); host.syncMesToSwipe(index);
    message.swipes!.push('另一条回复：艾琳受了轻伤。'); message.swipe_info!.push({ extra: {} });
    const choose = (swipeId: number) => host.swipe(null, swipeId ? constants.SWIPE_DIRECTION.RIGHT : constants.SWIPE_DIRECTION.LEFT,
        { source: constants.SWIPE_SOURCE.SWIPE_PICKER, forceMesId: index, forceSwipeId: swipeId, forceDuration: 0 });
    await choose(1);
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(initial), 'K5: new swipe starts before old effects');
    const alternate = accepted(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 45 }])).state;
    await choose(0); requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(original), 'K5: original swipe restored');
    await choose(1); requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(alternate), 'K5: alternate swipe restored');
    await host.deleteSwipe(1, index);
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(original), 'K5: selected swipe deletion restores remaining choice');
    return { original, alternate, restored: accepted(await api.inspect()).state };
}

/** K10: actual native swipe events must finish while the first network save is held. */
export async function verifySavingSelections(api: State3Api) {
    const host = await loadHost(), ctx = getContext(), constantsUrl = '/scripts/constants.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const constants = await import(/* @vite-ignore */ constantsUrl) as { SWIPE_DIRECTION: { LEFT: unknown; RIGHT: unknown }; SWIPE_SOURCE: { SWIPE_PICKER: unknown } };
    const index = ctx.chat.length - 1, message = ctx.chat[index];
    host.ensureSwipes(message); host.syncMesToSwipe(index);
    const alternate = message.swipes!.length;
    message.swipes!.push('没有受伤的另一条回复。'); message.swipe_info!.push({ extra: {} });
    const choose = (id: number) => host.swipe(null, id ? constants.SWIPE_DIRECTION.RIGHT : constants.SWIPE_DIRECTION.LEFT,
        { source: constants.SWIPE_SOURCE.SWIPE_PICKER, forceMesId: index, forceSwipeId: id, forceDuration: 0 });
    const health = async () => (accepted(await api.inspect()).state as { hero: { health: number } }).hero.health;
    const bounded = async <T>(promise: Promise<T>): Promise<T> => {
        let timer!: ReturnType<typeof setTimeout>;
        try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('K10: native event waited for network save')), 5000); })]); }
        finally {clearTimeout(timer);}
    };
    const waitFor = async (ready: () => boolean | Promise<boolean>) => {
        for (let count = 0; count < 200; count++) {
            if (await ready()) {return;}
            await new Promise<void>(resolve => setTimeout(resolve, 25));
        }
        throw new Error('K10: save result not delivered');
    };
    let announce!: () => void, release!: () => void, hold = true, fail = false, saves = 0;
    const entered = new Promise<void>(resolve => { announce = resolve; });
    let gate = new Promise<void>(resolve => { release = resolve; });
    const nativeFetch = globalThis.fetch;
    const persisted = async () => {
        const live = getContext(), card = live.characters[live.characterId];
        const revision = (live.chatMetadata['lwb-state3'] as { revision: number }).revision;
        await waitFor(async () => {
            const response = await nativeFetch('/api/chats/get', { method: 'POST', headers: live.getRequestHeaders(),
                body: JSON.stringify({ ch_name: card.name, file_name: card.chat, avatar_url: card.avatar }), cache: 'no-store' });
            if (!response.ok) {throw new Error('K10: saved chat read failed');}
            const data = await response.json() as { chat_metadata?: { 'lwb-state3'?: { revision: number } } }[];
            return data[0]?.chat_metadata?.['lwb-state3']?.revision === revision;
        });
    };
    globalThis.fetch = async (input, init) => {
        if (String(input).endsWith('/api/chats/save')) {
            saves++;
            if (hold) { hold = false; announce(); await gate; }
            if (fail) {return Response.json({ error: 'isolated save failure' }, { status: 503 });}
        }
        return nativeFetch(input, init);
    };
    let pending: ReturnType<State3Api['apply']> | undefined;
    try {
        pending = api.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]);
        await bounded(entered);
        await bounded(choose(alternate)); requireValue(await health() === 80, 'K10: restored before save returns');
        const variables = getContext().chatMetadata.variables as Record<string, string>;
        requireValue(JSON.parse(variables.hero).health === 80, 'K10: native variables follow selection before saving');
        await bounded(choose(0)); requireValue(await health() === 20, 'K10: restored original during same save');
        await bounded(choose(alternate)); requireValue(await health() === 80, 'K10: third selection not dropped');
        release(); accepted(await pending);
        await waitFor(() => { const result = api.lastResult(); return Boolean(result?.ok && result.saved); });
        await persisted(); await host.reloadCurrentChat();
        requireValue(await health() === 80 && getContext().chat[index].swipe_id === alternate, 'K10: newest selection persisted, not the old delayed save');

        fail = true;
        await bounded(choose(0)); requireValue(await health() === 20, 'K10: failed save does not block restoration');
        await waitFor(() => { const result = api.lastResult(); return Boolean(result?.ok && result.saved === false); });
        fail = false; await api.retrySave();
        await persisted(); await host.reloadCurrentChat();
        requireValue(await health() === 20 && getContext().chat[index].swipe_id === 0, 'K10: retry persists current selection');
        const record = getContext().chat[index].swipe_info![0].extra!['lwb-state3'] as { entries: unknown[] };
        requireValue(record.entries.length === 1, 'K10: retry does not repeat settlement');
        const tail: ChatMessage = { name: message.name, mes: '新增楼层的轻伤。', is_user: false, extra: {} };
        getContext().chat.push(tail); host.addOneMessage(tail);
        const tailEntered = new Promise<void>(resolve => { announce = resolve; });
        gate = new Promise<void>(resolve => { release = resolve; }); hold = true;
        pending = api.apply([{ op: 'set', path: ['hero', 'health'], value: 35 }]);
        await bounded(tailEntered);
        await bounded(host.deleteLastMessage()); requireValue(await health() === 20, 'K10: tail restoration does not wait for saving');
        release(); accepted(await pending);
        await persisted(); await host.reloadCurrentChat();
        requireValue(await health() === 20, 'K10: restored tail, not deleted tail, survives reopening');
        return { restoredWhileSaving: 80, returnedWhileSaving: 20, finalSelection: 80, failedSaveKept: 20, retryKept: 20, tailRestored: await health(), saves };
    } finally {
        fail = false; release(); globalThis.fetch = nativeFetch;
        if (pending) {await pending;}
    }
}

/** Authored card: purchase and first reward restore together, never by rerunning their trigger. */
export async function verifyRewardHistory(api: State3Api) {
    const host = await loadHost(), ctx = getContext(), constantsUrl = '/scripts/constants.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const constants = await import(/* @vite-ignore */ constantsUrl) as { SWIPE_DIRECTION: { LEFT: unknown; RIGHT: unknown }; SWIPE_SOURCE: { SWIPE_PICKER: unknown } };
    const saved = accepted(await api.inspect()).state;
    const start = (await api.stage({ replace: true })).snapshot;
    const index = ctx.chat.length - 1, message = ctx.chat[index];
    host.ensureSwipes(message); host.syncMesToSwipe(index);
    const alternateId = message.swipes!.length;
    message.swipes!.push('仅购买一瓶12金币的药水，没有卸下护符。'); message.swipe_info!.push({ extra: {} });
    const choose = (swipeId: number) => host.swipe(null, swipeId ? constants.SWIPE_DIRECTION.RIGHT : constants.SWIPE_DIRECTION.LEFT,
        { source: constants.SWIPE_SOURCE.SWIPE_PICKER, forceMesId: index, forceSwipeId: swipeId, forceDuration: 0 });
    await choose(alternateId);
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(start), 'K5: reward and purchase undone on alternate swipe');
    const alternate = accepted(await api.apply([{ action: 'buy_potion', params: {} }])).state;
    await choose(0); requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(saved), 'K5: reward restored without another claim');
    await choose(alternateId); requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(alternate), 'K5: alternate purchase restored exactly');
    await choose(0); await ctx.saveChat(); await host.reloadCurrentChat();
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(saved), 'K5: real reward survives saved reload');
    accepted(await api.undo({ all: true }));
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(start), 'K5: explicit undo includes first reward flag');
    const reapplied = accepted(await api.apply([{ action: 'unequip', params: {} }, { action: 'buy_potion', params: {} }], { source: 'model' }));
    requireValue(JSON.stringify(reapplied.state) === JSON.stringify(saved), 'K5: reward can be earned once after undo');
    const next: ChatMessage = { name: getContext().characters[getContext().characterId].name, mes: '重新戴上护符。', is_user: false, extra: {} };
    getContext().chat.push(next); host.addOneMessage(next);
    accepted(await api.apply([{ action: 'equip', params: {} }]));
    await host.deleteLastMessage();
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(saved), 'K5: tail undo preserves earlier purchase and reward');
    return { start, saved, alternate, restored: accepted(await api.inspect()).state };
}

export async function verifyChatOrganization(api: State3Api) {
    const host = await loadHost(), ctx = getContext();
    const add = async (text: string, input: unknown) => {
        const message: ChatMessage = { name: ctx.characters[ctx.characterId].name, mes: text, is_user: false, extra: {} };
        ctx.chat.push(message); host.addOneMessage(message);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        return accepted(await api.apply(input)).state;
    };
    await add('整理用中间回复', [{ op: 'set', path: ['hero', 'health'], value: 30 }]);
    const final = await add('尾部回复', [{ op: 'set', path: ['hero', 'health'], value: 20 }]);
    ctx.chat[0].mes = '编辑后的正文'; ctx.chat[0].is_system = true;
    await host.eventSource.emit(host.event_types.MESSAGE_EDITED, 0);
    await host.eventSource.emit(host.event_types.MESSAGE_UPDATED, 0);
    await host.deleteMessage(ctx.chat.length - 2);
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(final), 'K5: middle deletion/edit/hide preserve state');
    await ctx.saveChat(); await host.reloadCurrentChat();
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(final), 'K5: reopen does not reinterpret organization');
    await host.deleteLastMessage();
    const restored = accepted(await api.inspect()).state;
    requireValue((restored as { hero: { health: number } }).hero.health === 30, 'K5: tail undo restores effects even with middle record absent');
    return { final, restored };
}

export async function verifyStorage(api: State3Api, size = 10000, turns = 160) {
    const inventory = Array.from({ length: size }, (_, index) => ({ id: 'item-' + index, quantity: 10 }));
    const bundle: Bundle = { definition: {
        format: 1, updates: ['after'], name: 'Storage acceptance', initial: { inventory },
        schema: { type: 'object', required: ['inventory'], additionalProperties: false, properties: { inventory: { type: 'array', items: {
            type: 'object', required: ['id', 'quantity'], additionalProperties: false, properties: { id: { type: 'string' }, quantity: { type: 'number' } },
        } } } },
        access: [{ path: ['inventory'], direct: true, description: 'Inventory' }], rules: [], actions: [], constraints: [], functions: {}, views: {},
    }, functions: {} };
    // Call on a freshly created isolated fixture only.
    await verifyScopedSave(api, bundle); accepted(await api.enable());
    const ctx = getContext(), host = await loadHost();
    const initialBytes = JSON.stringify(ctx.chatMetadata).length;
    const started = performance.now();
    for (let index = 0; index < turns; index++) {
        const message: ChatMessage = { name: ctx.characters[ctx.characterId].name, mes: 'storage turn ' + index, is_user: false, extra: {} };
        ctx.chat.push(message); host.addOneMessage(message);
        accepted(await api.apply([{ op: 'set', path: ['inventory', String(Math.floor(size / 2)), 'quantity'], value: index }]));
    }
    const elapsedMs = performance.now() - started;
    const records = ctx.chat.flatMap(message => (message.swipe_info?.[message.swipe_id || 0]?.extra?.['lwb-state3'] || message.extra?.['lwb-state3']) as object || []);
    const recordBytes = records.map(record => new TextEncoder().encode(JSON.stringify(record)).byteLength);
    requireValue(Math.max(...recordBytes) < 1800, 'K5: one element has a bounded receipt independent of inventory');
    const expected = accepted(await api.inspect()).state;
    const reopen = performance.now(); await host.reloadCurrentChat(); const recovered = accepted(await api.inspect()).state;
    requireValue(JSON.stringify(recovered) === JSON.stringify(expected), 'K5: long chat reopen preserves state');
    const history = getContext().chatMetadata['lwb-state3'] as { checkpoints: Json[] };
    requireValue(history.checkpoints.length === 2, 'K5: only two checkpoint snapshots');
    return { size, turns, elapsedMs, initialBytes, metadataBytes: JSON.stringify(getContext().chatMetadata).length,
        recordsBytes: recordBytes.reduce((total, bytes) => total + bytes, 0), maxRecordBytes: Math.max(...recordBytes), reopenMs: performance.now() - reopen,
        heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize };
}

/** Exercise host persistence and rejection of stale candidates without provider requests. */
export async function verifyPersistence(api: State3Api) {
    const host = await loadHost(), ctx = getContext();
    api.saveSettings({ ...api.settings(), auto: false });
    const add = (mes: string) => {
        const message: ChatMessage = { name: ctx.characters[ctx.characterId].name, send_date: String(Date.now()), mes, is_user: false, extra: {} };
        ctx.chat.push(message); host.addOneMessage(message); return message;
    };
    add('取下护符');
    accepted(await api.apply([{ action: 'unequip', params: {} }]));
    const nativeFetch = globalThis.fetch;
    let rejectedSaves = 0;
    try {
        globalThis.fetch = async (input, init) => {
            if (String(input).endsWith('/api/chats/save')) { rejectedSaves++; return new Response('isolated save failure', { status: 503 }); }
            return nativeFetch(input, init);
        };
        const unsaved = accepted(await api.apply([{ action: 'equip', params: {} }]));
        requireValue(unsaved.committed === true && unsaved.saved === false, 'K6: save failure remains a committed unsaved result');
        const state = accepted(await api.inspect()).state;
        globalThis.fetch = nativeFetch;
        await api.retrySave(); await host.reloadCurrentChat();
        requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(state), 'K6: retry only saves, no repeated equipment action');
    } finally { globalThis.fetch = nativeFetch; }
    const stale = await api.stage();
    accepted(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 20 }]));
    let revisionRejected = false;
    try {await stale.run([], { preview: false });} catch (error) {revisionRejected = (error as { code: string }).code === 'stale-target';}
    requireValue(revisionRejected, 'K7: changed variable start rejects old async candidate');
    const otherChat = await api.stage(); await createFixture();
    let chatRejected = false;
    try {await otherChat.run([], { preview: false });} catch (error) {chatRejected = (error as { code: string }).code === 'stale-target';}
    requireValue(chatRejected, 'K7: switched chat rejects old async candidate');
    return { rejectedSaves, revisionRejected, chatRejected };
}

/** One real update call, retaining its actual protocol exchanges for semantic review. */
export async function verifyModelUpdate(api: State3Api) {
    const agent = window.xiaobaixAgent;
    if (!agent) {throw new Error('Agent API unavailable');}
    const requests: AgentChatInput[] = [], responses: AgentChatResult[] = [];
    const before = accepted(await api.inspect()).state, body = getContext().chat.map(message => message.mes);
    window.xiaobaixAgent = { ...agent, async openSession(options) {
        const session = await agent.openSession(options);
        return { ...session, async chat(input) {
            requests.push(input); const response = await session.chat(input); responses.push(response); return response;
        } };
    } };
    try {
        const result = await api.update();
        const after = accepted(await api.inspect()).state;
        requireValue(JSON.stringify(getContext().chat.map(message => message.mes)) === JSON.stringify(body), 'K1: model update never edits prose');
        return { before, after, result, requests, responses };
    } finally {window.xiaobaixAgent = agent;}
}

/** Native RP assembly/lifecycle, with only its unconfigured transport forwarded to the configured Agent API. */
export async function verifyNativeChat(api: State3Api) {
    const host = await loadHost(), agent = window.xiaobaixAgent!, oldFetch = window.fetch, settings = api.settings();
    const openaiUrl = '/scripts/openai.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const openai = await import(/* @vite-ignore */ openaiUrl) as { oai_settings: { stream_openai: boolean; openai_max_context: number } };
    const oldStream = openai.oai_settings.stream_openai, oldBudget = openai.oai_settings.openai_max_context, connection = host.online_status;
    const session = await agent.openSession({ api: 'main' });
    const updates: AgentChatInput[] = [], responses: AgentChatResult[] = [];
    let rpMessages: AgentChatInput['messages'] = [], rp: AgentChatResult | undefined, forwarded = false;
    const before = accepted(await api.inspect()).state, previous = api.lastResult();
    try {
        api.saveSettings({ ...settings, auto: true, source: 'main' });
        openai.oai_settings.stream_openai = false; openai.oai_settings.openai_max_context = 32768;
        host.setOnlineStatus('acceptance-agent-transport');
        window.xiaobaixAgent = { ...agent, async openSession(options) {
            const own = await agent.openSession(options);
            return { ...own, async chat(task) { updates.push(task); const result = await own.chat(task); responses.push(result); return result; } };
        } };
        window.fetch = async (input, init) => {
            if (!forwarded && String(input).endsWith('/api/backends/chat-completions/generate')) {
                forwarded = true;
                const request = JSON.parse(String(init?.body)) as { messages: AgentChatInput['messages'] };
                rpMessages = request.messages;
                rp = await session.chat({ systemPrompt: '', messages: rpMessages, tools: [] });
                requireValue(Boolean(rp.text.trim()), 'K1: real RP returned prose');
                return Response.json({ choices: [{ message: { role: 'assistant', content: rp.text }, finish_reason: 'stop', index: 0 }] });
            }
            return oldFetch(input, init);
        };
        const input = document.querySelector<HTMLTextAreaElement>('#send_textarea')!;
        input.value = '我把护符重新戴好，然后原地休息。这一轮只描写重新装备护符，不购买、不战斗，不推进其他事件。写一小段。';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await host.Generate('normal');
        for (let tick = 0; tick < 1200 && (api.lastResult() === previous || api.updateStatus().busy); tick++) {await new Promise<void>(resolve => setTimeout(resolve, 100));}
        const result = api.lastResult();
        requireValue(forwarded && updates.length > 0 && result !== previous && Boolean(result?.ok), 'K1/K9: native RP reply auto-settled through real Agent API');
        requireValue(JSON.stringify(rpMessages).includes('amulet'), 'K1: RP receives expanded state views');
        return { before, after: accepted(await api.inspect()).state, result, rpMessages, rp, updates, responses };
    } finally {
        session.dispose(); window.fetch = oldFetch; window.xiaobaixAgent = agent; api.saveSettings(settings);
        openai.oai_settings.stream_openai = oldStream; openai.oai_settings.openai_max_context = oldBudget; host.setOnlineStatus(connection);
    }
}

/** Controlled transport errors exercise the loaded updater, never an external paid retry. */
export async function verifyUpdaterRecovery(api: State3Api) {
    const agent = window.xiaobaixAgent!;
    const unexpectedWeb = () => { throw new Error('Variable recovery must not use web tools'); };
    const web = { getTools: unexpectedWeb, search: unexpectedWeb, fetch: unexpectedWeb, read: unexpectedWeb };
    const host = await loadHost(), ctx = getContext(), settings = api.settings();
    const message: ChatMessage = { name: ctx.characters[ctx.characterId].name, mes: '众人原地休息，没有发生变化。', is_user: false, extra: {} };
    ctx.chat.push(message); host.addOneMessage(message);
    const before = accepted(await api.inspect()).state, requests: AgentChatInput[] = [];
    const response = (input: unknown): AgentChatResult => {
        const call = { id: 'acceptance-' + requests.length, name: 'write', arguments: JSON.stringify({ state: input }) };
        return { text: '', thoughts: [], provider: 'acceptance', model: 'controlled', completion: 'complete', truncated: false, toolCalls: [call],
            reply: { role: 'assistant', content: '', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] } };
    };
    try {
        window.xiaobaixAgent = { ...agent, async openSession() { return {
            web,
            async chat(task) {requests.push(task); return response(requests.length === 1 ? [{ op: 'set', path: ['hero', 'maxHealth'], value: 999 }] : []);},
            toolResult(call, value) {return { role: 'tool', tool_call_id: call.id, toolName: call.name, content: JSON.stringify(value) };}, dispose() {},
        }; } };
        const corrected = accepted(await api.update());
        requireValue(requests.length === 2 && JSON.stringify(corrected.state) === JSON.stringify(before), 'K9: one correction, rejected candidate unchanged');
        requireValue(requests[1].messages.at(-1)?.role === 'user' && String(requests[1].messages.at(-1)?.content).includes('derived-write'), 'K9: exact rejection sent to correction');
        const correctedRequests = requests.map(({ signal: _signal, ...task }) => structuredClone(task));
        requests.length = 0;
        api.saveSettings({ ...settings, auto: true });
        const autoMessage: ChatMessage = { ...message, extra: {}, mes: '角色依旧休息。' };
        await host.eventSource.emit(host.event_types.GENERATION_STARTED, 'normal', {}, false);
        ctx.chat.push(autoMessage); host.addOneMessage(autoMessage);
        await host.eventSource.emit(host.event_types.MESSAGE_RECEIVED, ctx.chat.length - 1);
        await host.eventSource.emit(host.event_types.GENERATION_ENDED, ctx.chat.length - 1);
        for (let count = 0; count < 200 && !(requests.length === 2 && !api.updateStatus().busy); count++) {await new Promise<void>(resolve => setTimeout(resolve, 50));}
        requireValue(requests.length === 2 && !api.updateStatus().busy, 'K1/K9: actual automatic entry completes correction once');
        window.xiaobaixAgent = { ...agent, async openSession() { return {
            web,
            chat(task) {return new Promise((_resolve, reject) => { task.signal!.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }); });},
            toolResult(call, value) {return { role: 'tool', tool_call_id: call.id, toolName: call.name, content: JSON.stringify(value) };}, dispose() {},
        }; } };
        const pending = api.update();
        for (let count = 0; count < 100 && api.updateStatus().phase !== 'requesting'; count++) {await new Promise<void>(resolve => setTimeout(resolve, 50));}
        api.cancel(); const cancelled = await pending;
        requireValue(!cancelled.ok && cancelled.diagnostics[0].code === 'cancelled', 'K7: cancellation visible');
        requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(before), 'K7: cancelled request did not publish');
        return { correctedRequests, automaticRequests: requests, corrected: corrected.ok, cancelled };
    } finally { window.xiaobaixAgent = agent; api.saveSettings(settings); }
}

export async function verifyMovedTail(api: State3Api) {
    const host = await loadHost(), ctx = getContext();
    const start = accepted(await api.inspect()).state;
    const add = async (text: string, health: number) => {
        const message: ChatMessage = { name: ctx.characters[ctx.characterId].name, is_user: false, mes: text, extra: {} };
        ctx.chat.push(message); host.addOneMessage(message);
        accepted(await api.apply([{ op: 'set', path: ['hero', 'health'], value: health }]));
        return message;
    };
    const moved = await add('移动验收：先发生的受伤', 33);
    await add('移动验收：后发生的受伤', 22);
    const beforeMove = accepted(await api.inspect()).state, index = ctx.chat.length - 2;
    document.querySelector<HTMLElement>(`.mes[mesid="${index}"] .mes_edit`)!.click();
    for (let tick = 0; tick < 50 && !document.querySelector(`.mes[mesid="${index}"] .edit_textarea`); tick++) {await new Promise<void>(resolve => setTimeout(resolve, 20));}
    document.querySelector<HTMLElement>(`.mes[mesid="${index}"] .mes_edit_down`)!.click();
    for (let tick = 0; tick < 50 && ctx.chat.at(-1) !== moved; tick++) {await new Promise<void>(resolve => setTimeout(resolve, 20));}
    requireValue(ctx.chat.at(-1) === moved, 'K5: native move control changed order');
    document.querySelector<HTMLElement>(`.mes[mesid="${ctx.chat.length - 1}"] .mes_edit_done`)!.click();
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(beforeMove), 'K5: native move leaves variables alone');
    await ctx.saveChat(); await host.reloadCurrentChat();
    requireValue(JSON.stringify(accepted(await api.inspect()).state) === JSON.stringify(beforeMove), 'K5: reopening moved chat preserves current state');
    await host.deleteLastMessage();
    const restored = accepted(await api.inspect()).state;
    requireValue(JSON.stringify(restored) === JSON.stringify(start), 'K5: tail deletion reverses the moved record, without settlement');
    return { beforeMove, restored, start };
}
