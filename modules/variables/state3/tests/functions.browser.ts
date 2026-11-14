import type { State3Api } from '../runtime/api.js';
import type { Bundle, Json, Result } from '../types.js';

/**
 * Run in an isolated SillyTavern page against the loaded production API.
 * The runner transpiles this test, not the feature, before page evaluation.
 */
export async function verifyBuiltFunctions(api: State3Api) {
    const expect = (condition: boolean, name: string) => { if (!condition) {throw new Error(name);} };
    const bundle = (source: string): Bundle => ({ definition: {
        format: 1, updates: ['after'], name: 'Worker acceptance',
        schema: { type: 'object', properties: { output: {} }, required: ['output'], additionalProperties: false },
        initial: { output: null }, access: [], actions: [], constraints: [], views: {},
        rules: [{ id: 'compute', kind: 'derive', path: ['output'], value: { call: 'compute', args: [] }, description: 'Isolated calculation' }],
        functions: { compute: { reads: [], description: 'Isolated calculation' } },
    }, functions: { compute: source } });
    const output = (result: Result): Json => {
        if (!result.ok) {throw new Error(JSON.stringify(result.diagnostics));}
        return (result.state as { output: Json }).output;
    };
    const before = await api.inspect(), NativeWorker = globalThis.Worker;
    let created = 0, terminated = 0, dispatched = 0;
    let hook: (() => void) | undefined;
    class ObservedWorker extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) { super(url, options); created++; }
        override postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
            if (Array.isArray(options)) { super.postMessage(message, options); }
            else { super.postMessage(message, options); }
            dispatched++; hook?.();
        }
        override terminate() { super.terminate(); terminated++; }
    }
    globalThis.Worker = ObservedWorker;
    try {
        const absent = output(await api.tryDefinition(bundle(`()=>[typeof window,typeof document,typeof self,typeof fetch,
            typeof XMLHttpRequest,typeof WebSocket,typeof Worker,typeof process,typeof require,
            typeof localStorage,typeof indexedDB,typeof Date,typeof performance,typeof crypto,
            typeof setTimeout,typeof Math.random]`)));
        expect(Array.isArray(absent) && absent.length === 16 && absent.every(value => value === 'undefined'), 'K8: host capabilities unavailable');
        expect(output(await api.tryDefinition(bundle(`()=>Function('return typeof fetch')()`))) === 'undefined', 'K8: dynamic code stays in guest');
        for (const [source, phase, errorName] of [['()=>1;', 'source', 'SyntaxError'],
            ['()=>{throw new TypeError("broken inventory");}', 'execute', 'TypeError']]) {
            const result = await api.tryDefinition(bundle(source));
            expect(!result.ok && result.diagnostics[0].code === 'function_exception'
                && result.diagnostics[0].phase === phase && result.diagnostics[0].errorName === errorName
                && typeof result.diagnostics[0].guestStack === 'string', 'K8: Worker preserves guest error details');
        }
        const loop = bundle('()=>{while(true){}}');
        const timeout = await api.tryDefinition(loop);
        expect(!timeout.ok && timeout.diagnostics[0].code === 'function_work_limit', 'K8: infinite loop bounded');
        const controller = new AbortController();
        let ticks = 0;
        const heartbeat = setInterval(() => ticks++, 2);
        hook = () => setTimeout(() => controller.abort(), 5);
        const priorDispatch = dispatched;
        const aborted = await api.tryDefinition(loop, [], { signal: controller.signal });
        clearInterval(heartbeat); hook = undefined;
        expect(!aborted.ok && aborted.diagnostics[0].code === 'cancelled', 'K8: cancellation reaches Worker');
        expect(dispatched > priorDispatch && ticks > 0, 'K8: page remains responsive during execution');
        expect(output(await api.tryDefinition(bundle('()=>7'))) === 7, 'K8: recovery after interruption');
        expect(created === terminated, 'K8: every owned Worker terminated');
        expect(JSON.stringify(before) === JSON.stringify(await api.inspect()), 'K6: browser checks leave chat untouched');
        return { created, terminated, dispatched, ticks, capabilitiesUnavailable: 16 };
    } finally { globalThis.Worker = NativeWorker; }
}
