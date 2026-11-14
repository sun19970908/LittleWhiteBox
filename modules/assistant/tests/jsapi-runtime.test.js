import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { setImmediate } from 'node:timers';
import * as runtimeModule from '../runtime-src/jsapi-runtime.js';
import { JSAPI_ABORTED, JSAPI_CANCEL_NOTICE } from '../shared/jsapi-contract.js';
import { toolOutcome } from '../app-src/ui/tool-activity.js';
import { createHostToolRequestController } from '../app-src/runtime/host-tool-requests.js';
import { executeJavaScriptApi } from '../runtime-src/jsapi-execution.js';
import { parseJavaScriptApi } from '../runtime-src/jsapi-analysis.js';

// 验收契约（只覆盖高代价边界）：
// 正常读写与原生 JS 语义一致，真正修改不冒充只读；代价：协议错误、越权修改。
// 取消异步等待后不继续保存；已发出的操作不谎称撤销；代价：重复写入、数据损坏。
// 返回值、循环和截断如实反馈，没返回不冒充成功；代价：证据失真、盲目重试修改。
// 宿主传递取消信号且不扫描聊天来检查 API；代价：取消失效、大聊天卡死。
// API 抛出和返回的错误保留结构化原因，不携带请求配置；代价：错误修复、凭据泄露。
const manifest = JSON.parse(await readFile(new URL('../st-jsapi-manifest.json', import.meta.url), 'utf8'));
const args = code => ({ code, purpose: 'Check live state', expectedOutput: 'Evidence' });
const run = (code, options = {}) => runtimeModule.runJavaScriptApi({ ...args(code), manifest, ...options });
const analyze = code => runtimeModule.analyzeJavaScriptApiRequest({ code, manifest });
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

test('typed host errors keep their diagnostics across throw, return and JSON transport', async () => {
    const details = { fields: [{ path: ['inventory'], keyword: 'required' }] };
    details.self = details;
    const error = Object.assign(new TypeError('invalid inventory'), { code: 'INVALID_INVENTORY', status: 422, details,
        cause: new Error('missing row'), request: { headers: { authorization: 'private-token' } } });
    for (const throws of [true, false]) {
        const result = await run('return await ctx.loadWorldInfo("fixture");', { ctx: { loadWorldInfo() { if (throws) throw error; return error; } } });
        const issue = throws ? result.execution.error : result.output;
        assert.equal(result.ok, !throws);
        assert.equal(issue.code, error.code); assert.equal(issue.errorName, error.name); assert.equal(issue.status, 422);
        assert.deepEqual(issue.fields, details.fields); assert.equal(issue.cause.message, error.cause.message);
        assert.equal(issue.self, '[Circular]');
        assert.equal(issue.request, undefined); assert.equal(JSON.stringify(result).includes('private-token'), false);
        assert.deepEqual(JSON.parse(JSON.stringify(issue)), issue);
    }
});

test('syntax failures retain the location in the authored body', () => {
    assert.throws(() => parseJavaScriptApi('const a = 1;\nconst b = ;'), error => {
        assert.equal(error.loc.line, 2); assert.equal(error.loc.column, 10);
        assert.equal(error.pos, 23); return true;
    });
});

test('script exceptions preserve null and undefined instead of replacing them with wrapper failures', async () => {
    for (const value of [null, undefined, 42]) {
        let caught = false;
        try {await executeJavaScriptApi('throw ctx.value;', {ctx:{value},st:{}});}
        catch(error) {caught=true; assert.equal(error,value);}
        assert.equal(caught,true);
    }
});

test('ordinary data access, creation and JavaScript syntax have native results', async () => {
    const samples = [
        'const id=0; return ctx.chat[id];',
        'const key="title"; return ctx.chatMetadata[key];',
        'return ctx.chat.at(0).mes;',
        'const m=ctx.chat.at(0); return m.mes;',
        'return ctx.chat[0].mes.length + Number(ctx.chat[0].mes.includes("hello"));',
        'return [typeof ctx.chatMetadata.optional, ctx.chatMetadata.optional?.nested ?? null];',
        'if (typeof ctx.optionalMethod === "function") return ctx.optionalMethod(); return null;',
        'ctx.chatMetadata.fresh=1; return ctx.chatMetadata;',
        'delete ctx.chatMetadata.title; Object.assign(ctx.chatMetadata,{a:2}); return ctx.chatMetadata;',
        'const {chat}=getContext(); return chat.filter(m => !m.is_user).map(m => ({text:m.mes}));',
        'let n=0; const a=await (n++, Promise.resolve(3)); return [n,a];',
        'return (await Promise.resolve({value:3})).value;',
        'const f=async n => (await Promise.resolve(n), n+1); return await f(2);',
        'const f=async n => ({value:await Promise.resolve(n)}); return await f(2);',
        'let n=0; for(let i=0;i<3;i++) n+=i; do n++; while(n<5); return n;',
        'let n=0; for await (const v of [Promise.resolve(2),3]) {n+=v;} return n;',
        'let n=0; outer: for(let i=0;i<3;i++) {if(i===1)continue outer; n++;} return n;',
        'try {throw new Error("test");} catch(e) {return e.message;} finally {ctx.chatMetadata.checked=true;}',
        'switch(ctx.chat.length) {case 1: return "one"; default: return "other";}',
        'const n=2; const obj={n,async f(){return await Promise.resolve(this.n);}}; return `${await obj.f()}`;',
        'class Item {value=2; async read(){return await Promise.resolve(this.value);}} return await new Item().read();',
        '// leading comment\n"use strict"; const a=1; return\n a;',
    ];
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const context = () => ({ chat: [{ mes: 'hello', is_user: false }], chatMetadata: { title: 'sample' } });
    for (const code of samples) {
        const ctx = context(), nativeCtx = context();
        const expected = await new AsyncFunction('ctx', 'getContext', '"use strict";\n'+code)(nativeCtx, () => nativeCtx);
        const result = await run(code, { ctx });
        assert.equal(result.ok, true, `${code}\n${JSON.stringify(result.execution)}`);
        assert.deepEqual(result.output, expected === undefined ? '' : expected, code);
        assert.deepEqual(ctx, nativeCtx, code);
    }
});

test('deletion, mutation helpers, aliases, callbacks and destructuring cannot be classified as read-only', () => {
    const edits = [
        'delete ctx.chatMetadata.title;',
        'Object.assign(ctx.chatMetadata,{title:"changed"});',
        'Reflect.set(ctx.chatMetadata,"title","changed");',
        'const data=ctx.chatMetadata; data.fresh=1;',
        'let data=ctx.chatMetadata; if(false) data={}; data.fresh=1;',
        'const {data}={data:ctx.chatMetadata}; data.fresh=1;',
        'const [data]=[ctx.chatMetadata]; data.fresh=1;',
        'let data={}; [data]=[ctx.chatMetadata]; data.fresh=1;',
        'let data={}; for(data of ctx.chat) data.mes="changed";',
        'var data={}; if(true) {var data=ctx.chatMetadata;} data.fresh=1;',
        'var data=ctx.chatMetadata; if(false) {var data={};} data.fresh=1;',
        'for(ctx.chatMetadata.fresh of [1]) {}',
        '({data:ctx.chatMetadata.fresh}={data:1});',
        'ctx.chat.forEach(message => {message.mes="changed";});',
        'ctx.chat.forEach(ctx.saveMetadata);',
        'const save=ctx.saveMetadata; ctx.chat.map(save);',
        'JSON.parse("{}", ctx.saveMetadata);',
        'JSON.stringify({}, ctx.saveMetadata);',
        'Array.from(ctx.chat, ctx.saveMetadata);',
        'const from=Array.from; from(ctx.chat, ctx.saveMetadata);',
        '"text".replace(/text/, ctx.saveMetadata);',
        'const change = () => {ctx.chat[0].mes="changed";}; change();',
        'ctx.chat.splice(0,1);',
        'ctx.saveMetadata`save`;',
        'const {saveMetadata:save}=ctx; save();',
    ];
    for (const code of edits) assert.equal(analyze(`${code} return null;`).requestKind, 'effect', code);
    for (const code of ['return ctx.chat[0].mes;', 'return ctx.chat.at(0);', 'return await ctx.getTokenCountAsync("x");',
        'const copy=[]; copy.push(1); return copy;']) assert.equal(analyze(code).requestKind, 'read', code);
    assert.equal(analyze('return Object.keys(ctx.chatMetadata);').requestKind, 'inspect');
    assert.equal(analyze('return ctx.customCall();').requestKind, 'unknown');
    assert.equal(analyze('return await import("/fixture.js");').requestKind, 'unknown');
    assert.equal(analyze('call=ctx.saveMetadata; function call() {} call(); return null;').requestKind, 'unknown');
    assert.equal(analyze('return ctx.chat.map(ctx.getTokenCount);').requestKind, 'read');
    assert.equal(analyze('return ctx.chat.map(ctx.customCallback);').requestKind, 'unknown');
    assert.equal(analyze('return ctx.chat.map(message => message.mes);').requestKind, 'read');
});

test('known read promises stay read through callbacks without admitting writes or unknown thenables', () => {
    // Same read in await/callback form must not add approval; writes must still ask.
    // Cost: interrupted normal use or unapproved state changes.
    const reads = [
        'return await ctx.getTokenCountAsync("x");',
        'return ctx.getTokenCountAsync("x").then(n=>n);',
        'const p=ctx.getTokenCountAsync("x"); return p.then(n=>n+1).catch(()=>0).finally(()=>{});',
        'const {getTokenCountAsync:read}=ctx; const done=n=>n; return read("x")["then"](done);',
        'return ctx.getTokenCountAsync("x")?.then?.(n=>n);',
        'return st.script.getCharacters().then(()=>ctx.chat.length);',
        'const read=async()=>1; return read().then(n=>n);',
        'async function read(){return 1;} return read().then(n=>n);',
    ];
    for (const code of reads) assert.equal(analyze(code).requestKind, 'read', code);
    for (const method of ['then', 'catch', 'finally']) {
        for (const callback of ['ctx.saveMetadata', '()=>ctx.saveMetadata()', '()=>{ctx.chatMetadata.changed=true;}']) {
            const code=`return ctx.getTokenCountAsync("x").${method}(${callback});`;
            assert.equal(analyze(code).requestKind, 'effect', code);
        }
    }
    for (const code of [
        'return ctx.getTokenCountAsync("x").then(ctx.customCallback);',
        'return ctx.getTokenCountAsync("x").then(()=>ctx.customCall());',
        'return ctx.chatMetadata.then(n=>n);',
        'return ctx.getPresetManager().then(n=>n);',
        'const data=await ctx.loadWorldInfo("book"); return data.then(n=>n);',
        'let p=ctx.getTokenCountAsync("x"); p=ctx.chatMetadata; return p.then(n=>n);',
    ]) assert.equal(analyze(code).requestKind, 'unknown', code);
});

test('malformed function bodies cannot execute a silently truncated prefix', async () => {
    for (const code of [
        'ctx.saveMetadata(); return 1; } async function extra(){ return 2;',
        'ctx.saveMetadata(); return 1; } //',
        'ctx.saveMetadata(); return 1; } /*',
    ]) {
        let writes = 0;
        const result = await run(code, { ctx: { saveMetadata() { writes++; } } });
        assert.equal(result.ok, false, code);
        assert.equal(result.execution.errorCode, 'jsapi_validation_failed');
        assert.equal(writes, 0, 'Invalid code must not execute even its valid prefix');
    }
});

test('callback arguments preserve native receivers, values, spread and exceptions', async () => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    for (const code of [
        'return ctx.chat.map(ctx.convert, ctx.chatMetadata);',
        'return Array.from(...[ctx.chat, ctx.convert, ctx.chatMetadata]);',
        'const from=Array.from; return from(ctx.chat, ctx.convert, ctx.chatMetadata);',
        'return JSON.parse(`{"a":1}`, ctx.revive);',
        'return await Promise.resolve(4).then(...[ctx.convert]);',
        'return await Promise.resolve(4)?.then?.(ctx.convert);',
        'return await (Promise.resolve(4).then)(ctx.convert);',
        'return await Promise.resolve(4).then((ctx.convert, ctx.convert));',
        'return await Promise.resolve(4).then(ctx.convert).then(ctx.convert);',
        'let n=0; const task=Promise.resolve(4); return await task.then(ctx.convert).finally(()=>{n++;}).then(v=>[v,n]);',
        'const f=()=>1; const obj={map(value){return value===f;}}; return obj.map(f);',
        'try {await Promise.reject("failure").catch(ctx.raise);} catch(e) {return e.message;}',
    ]) {
        const context = () => ({ chat: [1, 2], chatMetadata: { factor: 3 },
            convert(value, index) { return [value, index ?? null, this?.factor ?? null]; },
            revive(key, value) { return key === 'a' ? value + 1 : value; },
            raise(value) { throw new Error(value); } });
        const expected = await new AsyncFunction('ctx', '"use strict";\n' + code)(context());
        const result = await run(code, { ctx: context() });
        assert.equal(result.ok, true, `${code}\n${JSON.stringify(result.execution)}`);
        assert.deepEqual(result.output, expected, code);
    }
});

test('missing returns, repeated objects, real cycles and truncated inspection produce honest receipts', async () => {
    let writes = 0;
    const rejected = await run('ctx.saveMetadata(); [1].map(x => {return x;});', { ctx: { saveMetadata() { writes++; } } });
    assert.equal(rejected.execution.errorCode, 'jsapi_validation_failed');
    assert.equal(writes, 0);
    const fallen = await run('ctx.saveMetadata(); if(false) return 1;', { ctx: { saveMetadata() { writes++; } } });
    assert.equal(fallen.execution.errorCode, 'jsapi_result_missing');
    assert.equal(writes, 1);
    const shared = { title: 'evidence' }, circular = { title: 'cycle' }; circular.self = circular;
    const result = await run('return {a:ctx.chat[0], b:ctx.chat[0], cycle:ctx.chat[1]};', { ctx: { chat: [shared, circular] } });
    assert.deepEqual(result.output, { a: shared, b: shared, cycle: { title: 'cycle', self: '[Circular]' } });
    const limited = await run('return Object.keys(ctx.chatMetadata);', { ctx: { chatMetadata: Object.fromEntries(Array.from({length:100}, (_,i)=>[i,i])) } });
    assert.equal(limited.ok, true);
    assert.equal(limited.truncated, true);
    assert.ok(limited.output.length < 100);
    const thrown = await run('return ctx.missing();');
    assert.equal(thrown.execution.errorCode, 'jsapi_execution_failed');
    assert.ok(thrown.execution.errorStack);
});

test('cancellation stops work after pending awaits, including catch, finally and the same expression', async () => {
    const scripts = [
        'await ctx.getTokenCountAsync("x"); ctx.saveMetadata(); return true;',
        'try {await ctx.getTokenCountAsync("x");} catch(e) {ctx.saveMetadata();} return true;',
        'try {await ctx.getTokenCountAsync("x");} finally {ctx.saveMetadata();} return true;',
        'return [await ctx.getTokenCountAsync("x"), ctx.saveMetadata()];',
        'return ctx.getTokenCountAsync("x");',
        'const f=async()=> {await ctx.getTokenCountAsync("x"); ctx.saveMetadata();}; await f(); return true;',
        'await ctx.getTokenCountAsync("x").then(ctx.saveMetadata); return true;',
        'await ctx.getTokenCountAsync("x").then(undefined, ctx.saveMetadata); return true;',
        'await ctx.getTokenCountAsync("x").catch(ctx.saveMetadata); return true;',
        'await ctx.getTokenCountAsync("x").finally(ctx.saveMetadata); return true;',
        'const save=ctx.saveMetadata; await ctx.getTokenCountAsync("x").then(save); return true;',
        'await ctx.getTokenCountAsync("x").then(...[ctx.saveMetadata, ctx.saveMetadata]); return true;',
        'await ctx.getTokenCountAsync("x").then(ctx.saveMetadata).catch(ctx.saveMetadata).finally(ctx.saveMetadata); return true;',
    ];
    for (const code of scripts) {
        for (const rejectLater of [false,true]) {
            const pending = deferred(), ready = deferred(), controller = new AbortController();
            let writes = 0;
            const ctx = { getTokenCountAsync() {ready.resolve(); return pending.promise;}, saveMetadata() {writes++;} };
            const running = run(code,{ctx,signal:controller.signal});
            await ready.promise;
            controller.abort();
            const receipt = await running;
            assert.equal(receipt.execution.errorCode, JSAPI_ABORTED, code);
            assert.equal(toolOutcome(receipt, 'RunJavaScriptApi').status, 'unconfirmed');
            if (rejectLater) pending.reject(new Error('late host failure')); else pending.resolve(1);
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(writes,0,code);
        }
    }
    const pending=deferred(), ready=deferred(), controller=new AbortController(); let writes=0;
    const result=run('await ctx.saveMetadata(); return true;', {signal:controller.signal,ctx:{async saveMetadata(){writes++; ready.resolve(); await pending.promise;}}});
    await ready.promise; controller.abort();
    const receipt=await result;
    pending.resolve();
    assert.equal(writes,1,'Cancellation does not undo an already-started host effect');
    assert.equal(receipt.execution.abortReason,JSAPI_CANCEL_NOTICE);
});

async function loadHost(ctx) {
    const source = await readFile(new URL('../assistant.js', import.meta.url), 'utf8');
    const needed = new Set(['runJavaScriptApi','ensureNotAborted','shapeJavaScriptApiOutputForTransport',
        'buildJavaScriptApiToolResult','buildJsApiExecutionState','buildDocumentedJsApiContext',
        'createAllowedPathTree','cloneDocumentedNamespace','cloneDocumentedValue']);
    const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
    const selected=ast.body.filter(node=>node.type==='FunctionDeclaration' && needed.has(node.id.name));
    assert.equal(selected.length,needed.size);
    // eslint-disable-next-line no-new-func -- Execute the actual host functions with isolated dependencies.
    return new Function('loadJsApiManifest','loadJsApiRuntimeModule','getContext','buildDocumentedJsApiNamespace','MAX_JSAPI_RETURN_CHARS',
        selected.map(node=>source.slice(node.start,node.end)).join('\n')+'\nreturn runJavaScriptApi;')(
        async()=>manifest,async()=>runtimeModule,()=>ctx,()=>({}),50*1024);
}

test('real host reads only requested chat data and carries cancellation into the executor', async () => {
    let reads=0,writes=0;
    const paused=deferred(),ready=deferred();
    const ctx={chat:Array.from({length:300},(_,i)=>({get mes(){reads++;return `message ${i}`;}})),
        chatMetadata:{},getTokenCountAsync(){ready.resolve();return paused.promise;},saveMetadata(){writes++;}};
    const host=await loadHost(ctx);
    const receipt=await host(args('const id=1; return ctx.chat[id].mes;'));
    assert.equal(receipt.ok,true);
    assert.equal(receipt.output,'message 1');
    assert.equal(reads,1);
    const controller=new AbortController();
    const pending=host(args('await ctx.getTokenCountAsync("x"); await ctx.saveMetadata(); return null;'),{signal:controller.signal});
    await ready.promise; controller.abort();
    const cancelled=await pending;
    paused.resolve(1);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(cancelled.execution.isAborted,true);
    assert.equal(writes,0);
});

test('bridge timeout and cancellation abort the host but keep the execution outcome unconfirmed', async t => {
    t.mock.method(console,'info',()=>{});
    for (const timeout of [false,true]) {
        const pendingToolCalls=new Map(),posted=[],controller=new AbortController();
        const requests=createHostToolRequestController({state:{},pendingToolCalls,post:(type,data)=>posted.push({type,data}),
            createRequestId:()=> 'fixture',REQUEST_TIMEOUT_MS:timeout?5:1000,describeError:error=>error.message});
        const pending=requests.callHostTool('RunJavaScriptApi',args('return 1;'),{signal:controller.signal});
        assert.equal(pendingToolCalls.get('fixture').dispatched,true);
        assert.equal(pendingToolCalls.get('fixture').toolName,'RunJavaScriptApi');
        if (!timeout) controller.abort();
        let error;
        try {await pending;} catch(cause) {error=cause;}
        assert.equal(error.message,timeout?'tool_timeout':'tool_aborted');
        assert.deepEqual(posted.map(item=>item.type),['xb-assistant:tool-call','xb-assistant:tool-abort']);
        assert.equal(pendingToolCalls.size,0);
        const failure=requests.buildToolFailureResult('RunJavaScriptApi',{},error);
        assert.equal(toolOutcome(failure,'RunJavaScriptApi').status,'unconfirmed');
        assert.ok(failure.message.includes(JSAPI_CANCEL_NOTICE));
    }
});
