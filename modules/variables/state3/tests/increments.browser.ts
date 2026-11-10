import { createFixture, verifyScopedSave } from './journey.browser.js';
import { equipmentExample } from '../definition/example.js';
import type { State3Api } from '../runtime/api.js';
import type { AgentChatResult } from '../../../agent-core/public-api.js';

/** I1/I4/I5: built API in an isolated host; no provider requests. Wrong counts silently corrupt saved state. */
export async function verifyIncrements(api: State3Api) {
    const hostUrl = '/script.js', constantsUrl = '/scripts/constants.js';
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const host = await import(/* @vite-ignore */ hostUrl);
    // eslint-disable-next-line no-unsanitized/method -- Fixed official host URL.
    const constants = await import(/* @vite-ignore */ constantsUrl);
    const context = () => (window as unknown as { SillyTavern: { getContext(): ReturnType<typeof host.getContext> } }).SillyTavern.getContext();
    const check = (condition: unknown, label: string) => { if (!condition) {throw new Error(label);} };
    const success = (result: Awaited<ReturnType<State3Api['apply']>>) => {
        if (!result.ok) {throw new Error(JSON.stringify(result.diagnostics));} return result;
    };
    const health = async () => (success(await api.inspect()).state as { hero: { health: number } }).hero.health;
    const inc = (delta: number) => ({ op: 'inc', path: ['hero', 'health'], delta, reason: '治疗恢复5点生命。' });
    const waitFor = async (ready: () => boolean) => {
        for (let count = 0; count < 200; count++) {
            if (ready()) {return;} await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
        throw new Error('increment event did not complete');
    };
    const fixture = await createFixture();
    await verifyScopedSave(api, equipmentExample()); success(await api.enable());
    const settings = api.settings(), agent = window.xiaobaixAgent!, nativeFetch = window.fetch;
    let modelCalls = 0, rejectedSaves = 0;
    try {
        api.saveSettings({ ...settings, auto: false });
        const before = JSON.stringify(context().chatMetadata);
        success(await api.preview([inc(5)])); success(await api.preview([inc(5)]));
        check(await health() === 80 && JSON.stringify(context().chatMetadata) === before, 'preview changed stored state');
        success(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 90 }, inc(20), inc(-20)]));
        check(await health() === 90, 'ordered direct batch changed correction timing');
        success(await api.undo({ all: true }));

        const message = { name: fixture.name, mes: '治疗恢复5点生命。', is_user: false, extra: {}, send_date: String(Date.now()) };
        context().chat.push(message); host.addOneMessage(message);
        const index = context().chat.length - 1;
        // R4: old text stays verbatim, executes nothing, and does not block independent updates.
        message.mes = '治疗恢复5点生命。<state3>' + JSON.stringify([inc(17)]) + '</state3>';
        host.ensureSwipes(message); host.syncMesToSwipe(index);
        await host.eventSource.emit(host.event_types.GENERATION_STARTED, 'normal', {}, false);
        await host.eventSource.emit(host.event_types.MESSAGE_RECEIVED, index);
        await host.eventSource.emit(host.event_types.GENERATION_ENDED);
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100))));
        check(await health() === 80 && !api.lastResult(), 'prose unexpectedly executed a settlement');
        await host.changeMainAPI('openai');
        window.xiaobaixAgent = { ...agent, async openSession() { return {
            web: { getTools() { throw new Error('unexpected web request'); }, search() { throw new Error('unexpected search'); }, fetch() { throw new Error('unexpected fetch'); }, read() { throw new Error('unexpected read'); } },
            async chat() {
                modelCalls++;
                const input = modelCalls === 1 ? [inc(5), inc(-1000)] : [inc(5)];
                const call = { id: 'controlled-' + modelCalls, name: 'write', arguments: JSON.stringify({ state: input }) };
                return { text: '', thoughts: [], provider: 'acceptance', model: 'controlled', completion: 'complete', truncated: false, toolCalls: [call],
                    reply: { role: 'assistant', content: '', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] } } as AgentChatResult;
            },
            toolResult(call, value) { return { role: 'tool', tool_call_id: call.id, toolName: call.name, content: JSON.stringify(value) }; }, dispose() {},
        }; } };
        success(await api.update());
        check(modelCalls === 2 && await health() === 85, 'correction counted the rejected candidate');
        success(await api.update()); check(await health() === 85, 'repeat update accumulated');
        api.saveSettings({ ...settings, auto: true });
        for (const type of ['normal', 'continue']) {
            const previous = api.lastResult();
            await host.eventSource.emit(host.event_types.GENERATION_STARTED, type, {}, false);
            await host.eventSource.emit(host.event_types.MESSAGE_RECEIVED, index);
            await host.eventSource.emit(host.event_types.GENERATION_ENDED);
            await waitFor(() => Boolean(api.lastResult()) && api.lastResult() !== previous);
            success(api.lastResult()!); check(await health() === 85, 'automatic continuation repeated increment');
        }
        const calls = modelCalls;
        await host.eventSource.emit(host.event_types.MESSAGE_RECEIVED, index);
        await host.eventSource.emit(host.event_types.GENERATION_ENDED);
        check(await health() === 85 && modelCalls === calls, 'duplicate event repeated update');
        api.saveSettings({ ...settings, auto: false });
        window.fetch = async (input, init) => {
            if (String(input).endsWith('/api/chats/save')) { rejectedSaves++; return Response.json({ error: 'isolated save failure' }, { status: 503 }); }
            return nativeFetch(input, init);
        };
        const unsaved = success(await api.apply([inc(5)]));
        check(unsaved.committed && unsaved.saved === false && await health() === 90, 'save failure lost committed increment');
        window.fetch = nativeFetch; await api.retrySave(); await host.reloadCurrentChat();
        check(await health() === 90, 'save retry or reopening repeated increment');

        const live = context().chat[index]; host.ensureSwipes(live); host.syncMesToSwipe(index);
        live.swipes.push('另一条回复：没有治疗。'); live.swipe_info.push({ extra: {} });
        const alternate = live.swipes.length - 1;
        const choose = (id: number) => host.swipe(null, id ? constants.SWIPE_DIRECTION.RIGHT : constants.SWIPE_DIRECTION.LEFT,
            { source: constants.SWIPE_SOURCE.SWIPE_PICKER, forceMesId: index, forceSwipeId: id, forceDuration: 0 });
        await choose(alternate); check(await health() === 80, 'swipe did not restore starting state');
        await choose(0); check(await health() === 90, 'swipe reapplied instead of restoring');
        await context().saveChat(); await host.reloadCurrentChat(); check(await health() === 90, 'selected result did not persist');
        success(await api.apply([{ op: 'set', path: ['hero', 'health'], value: 98 }]));
        const capped = success(await api.apply([inc(5)]));
        check(await health() === 100 && capped.changes.some(change => change.before === 98 && change.after === 100), 'cap result incorrect');
        check(capped.provenance.some(change => change.source.id === 'health-cap'), 'correction source missing');
        check(capped.annotations?.[0].fields[0][1] === '治疗恢复5点生命。', 'event reason rewritten');
        return { fixture, previewPreserved: 80, bodyIgnored: true, autoRepeated: 85, correctedUpdate: 85, repeatedUpdate: 85,
            saveRetry: 90, swipes: [80, 90], reopened: 90, capped: 100, modelCalls, rejectedSaves, providerCalls: 0 };
    } finally { window.fetch = nativeFetch; window.xiaobaixAgent = agent; api.saveSettings(settings); }
}
