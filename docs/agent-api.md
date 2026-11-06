# Agent 与联网公共 API

预设和任务脚本通过 `window.xiaobaixAgent` 使用 Agent 设置页的主 API、副 API，以及全局联网配置。接口不启动助手、不执行工具、不自动循环，也不修改酒馆聊天。调用方拥有提示词、消息历史、工具执行和结束条件。

本接口与 `LittleWhiteBox.callGenerate` 分开：后者的配置继承指向酒馆；本接口读取共享 Agent 设置。完整类型见 [public-api.d.ts](../modules/agent-core/public-api.d.ts)。

## 配置状态

```js
const agent = window.xiaobaixAgent;
const status = await agent.getStatus();
// { enabled, main: { configured, provider, model },
//   delegate: { configured, provider, model }, web: { configured, provider } }
```

状态只反映本地配置，不测试连接、不产生模型请求。模型 Key 可以留空，空 Key 不等于未配置；联网渠道缺少 Key 则不可用。副 API 必须已独立配置，选择未配置的副 API 会报错，不回退到主 API。

接口不返回 Key、地址、完整设置、请求头或请求诊断。

## 建立调用会话

```js
const controller = new AbortController();
const session = await agent.openSession({ api: 'main', signal: controller.signal });
// api: 'main' 为主 API；'delegate' 为副 API，不会启动委派助手。
try {
    const result = await session.chat({ messages });
    console.log(result.text);
} finally {
    session.dispose();
}
```

建立会话时固定一份当前配置，完整继承渠道、鉴权、模型、温度发送开关、输出上限、采样、思考和工具协议设置。修改设置影响后续新会话，不会在一个工具循环中途更换模型。本接口不提供配置覆盖或设置写回。

会话没有私有聊天记录：每次 `chat` 都传入调用方决定使用的完整历史。会话内同一时间只能进行一次请求；独立会话可以并行。

## 单轮调用

```js
const result = await session.chat({
    systemPrompt,                  // 可选；调用方自己的系统提示词
    messages,                      // 完整消息历史
    tools,                         // 可选；OpenAI 形状的 function 工具定义
    toolChoice: 'auto',             // auto / required / none；默认 auto
    signal: controller.signal,     // 可选；取消本次请求
    onStreamProgress(progress) {   // 可选；提供时接收流式进度
        showPreview(progress);
    },
});
```

返回字段包括：

| 字段 | 含义 |
| --- | --- |
| `text` | 实际收到的正文 |
| `thoughts` | 按思考展示设置投影的思考块 |
| `toolCalls` | 最终工具调用列表，含 `id`、`name`、JSON 字符串 `arguments`；部分渠道还带原始 ID 标识 |
| `reply` | 可追加到历史的完整 assistant 消息，保留渠道回放数据 |
| `provider`、`model` | 实际响应的渠道和模型信息 |
| `finishReason`、`completion`、`truncated` | 供应商结束原因、完成状态和是否到达输出上限 |
| `usage` | 供应商提供的用量；没有时不伪造 |

没有工具调用的回复同样返回 `reply`。`completion` 是结束元数据，不是内容可用性的替代判断：到达长度上限或缺少结束标记时仍保留实际收到的有效内容，不自动补发请求。明确拒绝、网络或供应商错误仍拒绝 Promise。

流式快照中的工具参数是草稿，只用于展示；必须等待 `chat` 成功返回，才能处理最终 `toolCalls`。异常结束的半截参数不会被修补成可执行工具调用。

`required` 沿用渠道已有约束，不是跨供应商的绝对保证。例如直连 OpenAI 兼容渠道的 DeepSeek 思考工具请求会按现行规则放宽为 `auto`，详见 [共享渠道规则](../modules/agent-core/README.md#deepseek-思考与工具调用)。

## 调用方自己的工具循环

下面的函数接收调用方提供的提示词、工具和执行函数；轮数限制也由调用方指定。

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

接口不会调用 `executeTool`、追加工具结果或发起下一轮；上面的动作都在调用方代码中。

### 工具结果

`session.toolResult(call, value)` 只构造消息，不发请求：

- JSON 对象按原样序列化。
- 字符串、数组、数字、布尔值和 `null` 包为 `{ result: value }` 后序列化。
- 保留调用 ID 和工具名，不把无供应商 ID 的 Gemini 调用误当成有供应商 ID。
- 不接受 `undefined`、循环引用等不能无损表达为 JSON 的值。

手写的 `role: 'tool'` 消息也必须使用 JSON 对象文本作为 `content`；建议使用这个辅助函数，避免纯文本在不同渠道中被丢失。

### 历史回放

将返回的 `reply` 原样加入下一轮历史，可以 JSON 克隆或保存。不要仅保留 `text`，也不要自行重建其 `tool_calls` 和 `providerPayload`：签名、加密推理和多段原生回复不能从展示文本恢复。

思考隐藏设置控制 `thoughts` 的展示，不意味着原生回放数据中没有思考块。回放字段应当作协议数据保留，不作为普通展示内容。

改写或压缩已签名的历史前缀可能使签名失效。需要更换上下文时，应重建新的上下文，不把旧签名直接搬过去。本接口不自动压缩或剥除签名。

## 联网

联网使用 Agent 页面里的全局配置，不分主、副模型。调用联网不需要先建立模型会话，模型会话也不会自动获得联网工具。

```js
const web = window.xiaobaixAgent.web;
const search = await web.search({ query, maxResults: 5, signal });
const pages = await web.fetch({ urls, signal });
```

搜索返回结构化结果；网页读取保留成功的正文以及 `failures`、`failedUrls` 等逐网址失败信息。部分提取失败不丢成功正文；调用级网络、鉴权、配置错误直接报错。取消仍抛出 `AbortError`。

请求限制、渠道选择及 Exa 后端路径复用 [共享联网规则](../modules/agent-core/README.md#共享联网)，不另做回退或自动重试。

如需让模型选择联网，显式加入现成工具定义，再由任务执行：

```js
const tools = [...ownTools, ...agent.web.getTools()];

async function executeTool(name, args, signal) {
    if (name === 'web_search') return agent.web.search({ ...args, signal });
    if (name === 'web_fetch') return agent.web.fetch({ ...args, signal });
    return executeOwnTool(name, args, signal);
}
```

`getTools()` 返回独立的定义副本，不会修改调用方工具列表。查询失败是否作为工具结果交回模型、是否重试，都由任务决定。

## 取消、停用与错误

- `openSession` 的信号控制整个会话；`chat` 的信号控制本次请求。
- `session.dispose()` 取消当前请求并结束会话。
- 关闭小白X总开关会取消公共请求并使旧会话失效；重新启用后建立新会话即可。公共对象仍可用于查询状态。
- 取消不会在稍后返回成功结果。接口不重试付费调用，也不在失败后切换模型或联网渠道。
- 错误通过 Promise 拒绝传播，包含稳定错误码及脱敏说明，适用时包含 HTTP 状态；不暴露原始 SDK 异常、请求对象或配置凭据。

## 构建与所有权

实现由 Agent Core 所有，宿主仅注册全局入口、实时请求头及停用清理。主副选择使用共享设置仓库；会话和取消状态只存在于当前运行中，没有新增聊天存储或配置表。

外部脚本使用已注册的全局对象，不直接导入带 SDK 裸包依赖的源码。插件构建同时在现有 `runtime/agent-core` 入口导出工厂，供宿主装配和构建产物验证使用。
