// Vertex GenerateContent partialArgs contract:
// https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling#streaming_function_call_arguments
const ERRORS = Object.freeze({
    path: 'Vertex 返回了无法解析的工具参数路径。',
    fragment: 'Vertex 返回了无效的工具参数分片。',
    identity: 'Vertex 工具参数分片缺少可对应的调用。',
    incomplete: 'Vertex 工具参数尚未接收完整，未执行工具。',
});

function fail(kind) {
    throw Object.assign(new Error(ERRORS[kind]), { code: `VERTEX_TOOL_STREAM_${kind.toUpperCase()}` });
}

// Only property/index JSONPath steps; never evaluate expressions or traverse prototypes.
function parsePath(path) {
    if (typeof path !== 'string' || !path.startsWith('$')) fail('path');
    const steps = [];
    let rest = path.slice(1);
    while (rest) {
        const match = rest.match(/^(?:\.([^.[\]]+)|\[(\d+)\]|\[("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\])/);
        if (!match) fail('path');
        if (match[1] !== undefined) steps.push(match[1]);
        else if (match[2] !== undefined) {
            const index = Number(match[2]);
            if (!Number.isSafeInteger(index) || index >= 0xffffffff) fail('path');
            steps.push(index);
        } else {
            try {
                steps.push(match[3][0] === '"' ? JSON.parse(match[3])
                    : match[3].slice(1, -1).replace(/\\(['\\])/g, '$1'));
            } catch { fail('path'); }
        }
        rest = rest.slice(match[0].length);
    }
    if (!steps.length || typeof steps[0] !== 'string') fail('path');
    return steps;
}

function setOwn(target, key, value) {
    Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

function appendArgument(call, fragment) {
    const steps = parsePath(fragment.jsonPath);
    const key = JSON.stringify(steps);
    let parent = call.part.functionCall.args;
    for (let index = 0; index < steps.length - 1; index++) {
        const step = steps[index];
        if (!Object.hasOwn(parent, step)) setOwn(parent, step, typeof steps[index + 1] === 'number' ? [] : {});
        parent = parent[step];
        if (!parent || typeof parent !== 'object') fail('fragment');
    }
    const leaf = steps.at(-1);
    const fields = ['stringValue', 'numberValue', 'boolValue', 'nullValue'].filter(field => Object.hasOwn(fragment, field));
    if (fields.length > 1) fail('fragment');
    const continuing = call.strings.has(key);
    const field = fields[0];
    if (continuing) {
        if (field && field !== 'stringValue') fail('fragment');
        if (field && typeof fragment[field] !== 'string') fail('fragment');
        setOwn(parent, leaf, parent[leaf] + (fragment.stringValue ?? ''));
    } else {
        if (!field) fail('fragment');
        if ((field === 'stringValue' && typeof fragment[field] !== 'string')
            || (field === 'numberValue' && !Number.isFinite(fragment[field]))
            || (field === 'boolValue' && typeof fragment[field] !== 'boolean')) fail('fragment');
        setOwn(parent, leaf, field === 'nullValue' ? null : fragment[field]);
    }
    if (fragment.willContinue === true) {
        if (field !== 'stringValue') fail('fragment');
        call.strings.add(key);
    } else call.strings.delete(key);
}

export function createVertexStreamAccumulator(internalIdPrefix) {
    const parts = [];
    const calls = [];
    const byId = new Map();
    let current = null;

    function toolCalls() {
        return calls.map(call => ({
            id: call.localId,
            name: call.part.functionCall.name,
            arguments: JSON.stringify(call.part.functionCall.args),
            ...(call.part.functionCall.id ? { providerId: call.part.functionCall.id } : { providerId: '' }),
        }));
    }

    function append(response) {
        for (const source of response?.candidates?.[0]?.content?.parts || []) {
            if (!Object.hasOwn(source, 'functionCall')) {
                parts.push(structuredClone(source));
                continue;
            }
            const item = source.functionCall;
            if (!item || typeof item !== 'object') fail('fragment');
            const id = item.id || '';
            let call = id ? byId.get(id) : current;
            if (call && item.name && item.name !== call.part.functionCall.name) fail('identity');
            if (!call) {
                if (!item.name) fail('identity');
                const part = { functionCall: { ...(id ? { id } : {}), name: item.name, args: {} } };
                call = { part, localId: id || `${internalIdPrefix}-${calls.length + 1}`, open: false, strings: new Set() };
                parts.push(part);
                calls.push(call);
            }
            if (id) {
                byId.set(id, call);
                call.part.functionCall.id = id;
            }
            for (const [key, value] of Object.entries(source)) {
                if (key !== 'functionCall') setOwn(call.part, key, structuredClone(value));
            }
            // Protobuf JSON null is unset; New API's Gemini DTO also emits args:null
            // on fragments because its args field is not omitempty.
            if (item.args != null) {
                if (typeof item.args !== 'object' || Array.isArray(item.args)) fail('fragment');
                for (const [key, value] of Object.entries(item.args)) setOwn(call.part.functionCall.args, key, structuredClone(value));
            }
            if (item.partialArgs !== undefined) {
                if (!Array.isArray(item.partialArgs)) fail('fragment');
                for (const fragment of item.partialArgs) appendArgument(call, fragment);
            }
            call.open = item.willContinue === true;
            if (!call.open && call.strings.size) fail('incomplete');
            if (call.open) current = call;
            else if (current === call) current = null;
        }
        return toolCalls();
    }

    function finish() {
        if (calls.some(call => call.open || call.strings.size)) fail('incomplete');
        return { toolCalls: toolCalls(), content: parts.length ? { role: 'model', parts: structuredClone(parts) } : null };
    }

    return { append, finish };
}
