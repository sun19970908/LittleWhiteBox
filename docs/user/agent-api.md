# Agent 与联网接口

这一页写给预设作者和循环任务脚本作者。你可以在脚本里通过 `window.xiaobaixAgent` 调用小白助手设置里配好的模型和联网渠道，自己决定提示词、消息历史、工具和什么时候结束。

这个接口不会启动小白助手、不会替你执行工具、不会自动多轮循环，也不会改动酒馆聊天。

它和 `LittleWhiteBox.callGenerate` 是两回事：`callGenerate` 使用酒馆当前的连接；这个接口使用 [小白助手的 API 配置](assistant.md#api-配置)。

## 启用功能

1. 打开 **扩展设置 → 小白X**，确认 `启用小白X` 已勾选。
2. 在 [小白助手的 API 配置](assistant.md#api-配置) 里配好 `主助手 API`；要用副 API，再配好 `分身 API`；要联网，再选好 `联网渠道（全局）` 并填 Key。
3. 在脚本里用 `window.xiaobaixAgent`。

## 查看配置状态

```js
const agent = window.xiaobaixAgent;
const status = await agent.getStatus();
// { enabled, main: { configured, provider, model },
//   delegate: { configured, provider, model }, web: { configured, provider } }
```

- 只读本地配置，不测试连接，不产生模型请求。
- 模型 Key 可以留空，空 Key 不等于未配置；联网渠道没有 Key 则不可用。
- 不返回 Key、地址、请求头等敏感信息。

## 建立会话

```js
const controller = new AbortController();
const session = await agent.openSession({ api: 'main', signal: controller.signal });
try {
    const result = await session.chat({ messages });
    console.log(result.text);
} finally {
    session.dispose();
}
```

| 参数 | 说明 |
| --- | --- |
| `api` | `'main'` 使用主助手 API；`'delegate'` 使用分身 API（只是换一套配置，不会启动分身助手） |
| `signal` | 取消整个会话 |

- 分身 API 必须单独配好；没配时会报错，不会自动改用主 API。
- 建立会话时会记下当时的整套配置。之后改设置只影响新会话，不会在工具循环中途换模型。
- 会话不保存聊天记录，每次 `chat` 都要传入完整历史。
- 一个会话同一时间只能有一次请求；多个会话可以并行。

## 单轮调用

```js
const result = await session.chat({
    systemPrompt,                  // 可选：你的系统提示词
    messages,                      // 完整消息历史
    tools,                         // 可选：OpenAI 格式的 function 工具定义
    toolChoice: 'auto',            // auto / required / none，默认 auto
    signal: controller.signal,     // 可选：只取消这一次请求
    onStreamProgress(progress) {   // 可选：接收流式进度
        showPreview(progress);
    },
});
```

返回值：

| 字段 | 含义 |
| --- | --- |
| `text` | 收到的正文 |
| `thoughts` | 思考块，每项含 `label` 和 `text` |
| `toolCalls` | 工具调用列表，每项含 `id`、`name` 和 JSON 字符串 `arguments` |
| `reply` | 可以直接追加到历史的完整 assistant 消息 |
| `provider`、`model` | 实际响应的渠道和模型 |
| `finishReason`、`completion`、`truncated` | 结束原因、是否完整（`complete` / `incomplete`）、是否到达输出上限 |
| `usage` | 用量；渠道没提供时为空 |

- 没有工具调用时也会返回 `reply`。
- 到达长度上限时，已收到的内容照常返回，不会自动补发。网络错误、供应商错误会让 Promise 失败。
- 流式进度里的工具参数只是草稿，只能用来显示。要等 `chat` 返回后再执行 `toolCalls`。
- `toolChoice: 'required'` 不保证所有渠道都遵守。例如直连 DeepSeek 并开着思考时，会按 DeepSeek 的要求改为 `auto`。

## 自己写工具循环

```js
async function runTask({ api = 'main', systemPrompt, initialMessages, tools,
    executeTool, maxTurns, signal }) {
    const session = await window.xiaobaixAgent.openSession({ api, signal });
    const messages = structuredClone(initialMessages);
    try {
        for (let turn = 0; turn < maxTurns; turn++) {
            const result = await session.chat({ systemPrompt, messages, tools, signal });
            messages.push(result.reply);
            if (!result.toolCalls.length) return { result, messages };
            for (const call of result.toolCalls) {
                const value = await executeTool(call.name, JSON.parse(call.arguments), signal);
                messages.push(session.toolResult(call, value));
            }
        }
        throw new Error('Task turn limit reached');
    } finally {
        session.dispose();
    }
}
```

执行工具、追加结果、发起下一轮，都在你自己的代码里。

### 工具结果

`session.toolResult(call, value)` 只生成一条工具结果消息，不发请求：

- 对象原样转成 JSON。
- 字符串、数组、数字、布尔值和 `null` 会包成 `{ result: value }`。
- 不接受 `undefined`、循环引用等无法转成 JSON 的值。

如果你自己写 `role: 'tool'` 消息，`content` 也要是 JSON 对象文本。建议直接用这个函数，避免纯文本在部分渠道里丢失。

### 保留历史

把返回的 `reply` 原样放进下一轮历史，可以克隆或保存。不要只保留 `text`，也不要自己重拼工具调用：有些模型的签名和加密思考只在 `reply` 里，丢了会导致下一轮报错。

改写或压缩带签名的旧历史可能让签名失效。需要换上下文时，重新组织一份新的上下文。

## 联网

联网使用 `联网渠道（全局）` 的配置，主、副 API 共用。模型不会自动获得联网工具，给不给、执行哪个，都由你决定。

### 在会话里联网

- `session.web.getTools()`：返回搜索、读网页和续读结果三个工具定义，直接加进 `tools` 即可。
- `await session.web.search({ query, maxResults, signal })`：搜索。
- `await session.web.fetch({ urls, signal })`：读取网页正文。
- `session.web.read({ reference, offset, signal })`：续读长结果，不发网络请求。

短结果直接返回。长结果会分页，返回 `{ ok, status, data }`：`status` 为 `read`、`partial` 或 `failed`；`data` 含 `reference`、`text`、`offset`、`nextOffset`、`totalChars`。用上一页的 `nextOffset` 继续读，`nextOffset` 为 `null` 表示读完。

- 每页 `text` 只是原始 JSON 的一段，不能单独解析，把各页拼起来才完整。
- 结果过期或已释放时，`read` 抛出 `tool_result_expired`；位置越界时抛出 `tool_result_range_invalid`。可以把错误交回模型，让它换位置或重新读取。
- 结果只存在内存里、只属于当前会话。`dispose()`、取消会话或关闭小白X后会清空。

### 不建会话直接联网

```js
const web = window.xiaobaixAgent.web;
const search = await web.search({ query, maxResults: 5, signal });
const pages = await web.fetch({ urls, signal });
```

这里返回完整原始结果，不分页。读网页时，成功的正文和失败信息（`failures`、`failedUrls`）都会保留；整个请求失败（网络、鉴权、配置）会直接报错。

让模型选择是否联网：

```js
const tools = [...ownTools, ...agent.web.getTools()];

async function executeTool(name, args, signal) {
    if (name === 'web_search') return agent.web.search({ ...args, signal });
    if (name === 'web_fetch') return agent.web.fetch({ ...args, signal });
    return executeOwnTool(name, args, signal);
}
```

渠道选 Exa 时，需要安装 [小白X 后端](server.md)。联网失败不会自动重试，也不会换渠道。

## 取消与错误

- `openSession` 的 `signal` 控制整个会话；`chat` 的 `signal` 只控制这一次请求。
- `session.dispose()` 会取消当前请求并结束会话。
- 关闭小白X总开关会取消所有请求，旧会话失效；重新开启后新建会话即可。`getStatus()` 仍然可用。
- 取消后不会再返回成功结果。接口不会重试付费请求，也不会在失败后换模型或渠道。
- 错误带有 `code`，适用时带 HTTP `status`，不包含密钥等敏感信息。

## 注意事项

- 每次 `chat` 都是真实的模型请求，会消耗额度。请在循环里设好轮数上限。
- 用完一定要 `dispose()`。

## 常见问题

### `getStatus()` 里 `delegate.configured` 是 `false`

还没配分身 API。到 [小白助手的 API 配置](assistant.md#api-配置) 切到 `分身 API` 页填好并保存。

### `web.configured` 是 `false`

`联网渠道（全局）` 所选渠道还没填 Key。
