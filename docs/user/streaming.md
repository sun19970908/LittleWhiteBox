# 流式生成命令

`/xbgen` 和 `/xbgenraw` 让你在不新增聊天楼层的情况下，额外调用一次 AI 生成文字。可以用在快速回复、[循环任务](tasks.md)、或者[代码块网页](render.md)里的 `STscript` 中，做状态栏刷新、旁白、选项生成之类的功能。

两个命令的区别：

| 命令 | 发给 AI 的内容 | 适合 |
| --- | --- | --- |
| `/xbgen` | 和正常聊天一样的完整上下文（预设、角色卡、世界书、聊天记录），再加上你的提示 | 需要 AI 了解当前剧情 |
| `/xbgenraw` | 只有你写的提示；需要时再用参数按需加上预设、聊天记录等 | 想完全控制发送内容，或者省 token |

## 启用功能

不需要单独开关，装好小白X、保持 **扩展设置 → 小白X → 渲染交互 → `启用小白X`** 勾选即可使用。

只支持聊天补全（Chat Completion）类 API，默认使用你当前在酒馆里选择的接口和模型。

## 快速上手

在聊天框输入：

```text
/xbgen nonstream=true 用一句话概括目前的剧情 | /echo
```

稍等片刻，屏幕上会弹出 AI 的概括。这层生成不会出现在聊天记录里。

再试试只发你自己写的内容：

```text
/xbgenraw nonstream=true 给我三个奇幻小镇的名字 | /echo
```

## 拿到生成结果

两个命令默认都是**流式**的：命令会立刻返回一个会话编号，生成在后台继续进行。

| 写法 | 命令返回 | 怎么拿到文字 |
| --- | --- | --- |
| 默认（流式） | 会话编号，比如 `1` | 在网页或脚本里读取，见[在网页和脚本里使用](#在网页和脚本里使用) |
| `nonstream=true` | 生成好的完整文字 | 直接用管道 `|` 传给下一个命令 |

在快速回复和 STscript 里，想把结果交给 `/setvar`、`/echo` 等命令，就加上 `nonstream=true`：

```text
/xbgen nonstream=true 根据剧情，用 10 个字以内描述角色此刻的心情 | /setvar key=心情
```

## 会话编号

用 `id` 参数可以同时跑多个互不干扰的生成，每个编号各存各的结果。

| 写法 | 结果 |
| --- | --- |
| 不写 | 编号 `1` |
| `1`–`100` 的数字 | 对应编号 |
| `xb1`–`xb100` | 对应编号（保留 `xb` 前缀） |
| 其他不超过 50 个字的文字 | 直接用作编号，例如 `id=状态栏` |

同一个编号再次生成时，会覆盖它上一次的结果。最多保留 100 个会话，超出时最久没用的会被清掉。

## `/xbgen` 参数

```text
/xbgen [参数] 提示文字
```

提示文字必填。

| 参数 | 可选值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `as` | `system` / `user` / `assistant` | `system` | 你的提示以什么身份发送 |
| `position` | `bottom` / `history` | `bottom` | `bottom` 放在全部内容最后；`history` 紧跟在聊天记录之后（预设里聊天记录后面的条目仍在它之后） |
| `nonstream` | `true` / `false` | `false` | 见[拿到生成结果](#拿到生成结果) |
| `lock` | `on` / `off` | `off` | `on` 时生成期间禁用发送按钮 |

另外还可以使用[通用参数](#通用参数)。

例子：

```text
/xbgen as=user position=history nonstream=true 用三句话推进剧情，不要替我说话 | /echo
```

## `/xbgenraw` 参数

```text
/xbgenraw [参数] 提示文字
```

只要写了下面任何一个结构参数，提示文字就可以省略。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `as` | `user` | 提示文字以什么身份发送：`system` / `user` / `assistant` |
| `nonstream` | `false` | 见[拿到生成结果](#拿到生成结果) |
| `lock` | `off` | `on` 时生成期间禁用发送按钮 |
| `topsys` / `topuser` / `topassistant` | — | 放在提示文字**前面**的一条 system / user / assistant 消息 |
| `bottomsys` / `bottomuser` / `bottomassistant` | — | 放在提示文字**后面**的一条消息 |
| `top` / `bottom` | — | 一次写多条，见[一次写多条消息](#一次写多条消息) |
| `top64` / `bottom64` | — | 同上，但内容用 base64url 编码，适合内容里有引号、分号等不好转义的符号 |
| `addon` | — | 从当前预设里带上指定内容，见[带上预设和上下文](#带上预设和上下文) |
| `stop` | — | 停止词，JSON 写法，例如 `stop=["\n\n"]` |

另外还可以使用[通用参数](#通用参数)。

发送顺序是：`top…` 的消息 → 提示文字 → `bottom…` 的消息。空的消息会被跳过。

```text
/xbgenraw topsys="你是一个只输出 JSON 的助手" nonstream=true 给出三个 RPG 职业名，格式 {"jobs":[...]} | /echo
```

### 一次写多条消息

`top` 和 `bottom` 里用分号分隔多条，每条写成 `身份={内容}`。身份可写 `sys`/`system`、`user`/`u`、`assistant`/`asst`/`ai`：

```text
/xbgenraw top="sys={你是旁白};user={描述一下这座城};assistant={好的，}" nonstream=true | /echo
```

也可以直接写 JSON 数组：

```text
/xbgenraw top=[{"role":"system","content":"你是旁白"}] 描述这座城 | /echo
```

### 带上预设和上下文

`addon` 用逗号分隔，可以组合：

| 值 | 带上的内容 |
| --- | --- |
| `preset` | 当前预设里已开启的条目（不含下面单列的几项） |
| `chatHistory` | 聊天记录 |
| `worldInfo` | 世界书 |
| `charDescription` | 角色描述 |
| `charPersonality` | 角色性格 |
| `scenario` | 场景 |
| `personaDescription` | 你的用户设定 |

```text
/xbgenraw addon=preset,charDescription,worldInfo nonstream=true 以角色的口吻写一句开场白 | /echo
```

- 只写 `worldInfo` 不写 `chatHistory` 时，聊天记录不会被发送，但世界书仍会按最近的聊天触发。
- `addon` 只在这一次生成中临时生效，不会改动你的预设。
- 重复的消息会自动去掉。

### 提示里可用的占位

在 `/xbgenraw` 的提示文字和 `top…`/`bottom…` 里可以写：

| 占位 | 替换成 |
| --- | --- |
| `{{user}}` / `<user>` | 你的名字 |
| `{{char}}` / `<char>` / `<character>` | 角色名 |
| `{{description}}` `{{personality}}` `{{scenario}}` `{{mesexamples}}` | 角色卡对应字段 |
| `{{persona}}` / `<persona>` | 你的用户设定 |
| `{{lastmessage}}` `{{lastusermessage}}` `{{lastcharmessage}}` | 最后一条消息 / 你的最后一条 / 角色的最后一条 |
| `{{getvar::名字}}` `{{getglobalvar::名字}}` | 变量值，支持 `名字.字段` 读取对象里的字段 |
| `{$history20}` | 最近 20 条聊天记录（数字可改，1–200），每条格式为 `说话人：` 加内容 |
| `{$worldInfo}` | 当前会被触发的世界书内容 |

```text
/xbgenraw topsys="以下是最近的对话：\n{$history10}" nonstream=true 总结上面的对话 | /echo
```

## 通用参数

两个命令都能用。不写时沿用酒馆当前的接口、模型和采样设置。

| 参数 | 说明 |
| --- | --- |
| `id` | 会话编号，见[会话编号](#会话编号) |
| `api` | 换接口：`openai` / `claude` / `gemini` / `cohere` / `deepseek` / `custom` |
| `model` | 换模型 |
| `apiurl` | 换接口地址（反向代理或自定义地址） |
| `apipassword` | 对应的密钥 |
| `net` | `on` 时开启联网搜索（仅 Gemini） |
| `temperature` `top_p` `top_k` `max_tokens` `presence_penalty` `frequency_penalty` | 采样参数，覆盖酒馆当前值 |

```text
/xbgenraw api=deepseek model=deepseek-chat temperature=0.3 nonstream=true 你好 | /echo
```

`apiurl` 对 OpenAI、Claude、Gemini、DeepSeek 和自定义（`custom`）接口有效。使用 Claude 模型时，如果最后一条是 assistant 或 system 消息，会自动转成 user 消息发送。

## 在网页和脚本里使用

代码块网页或脚本里可以通过 `window.xiaobaixStreamingGeneration` 读取流式结果（网页里写 `parent.xiaobaixStreamingGeneration`）：

| 方法 | 说明 |
| --- | --- |
| `getStatus(编号)` | 返回 `{ isStreaming, text, sessionId }`，`text` 是目前已经生成的文字 |
| `getLastGeneration(编号)` | 返回该会话最近一次的文字 |
| `getLastSessionId()` | 最近一次使用的会话编号 |
| `cancel(编号)` | 中止这个会话的生成 |

一个边生成边显示的例子：

```html
<div id="out">生成中...</div>
<script>
  (async () => {
    const id = await STscript('/xbgen id=旁白 用两句话描述窗外的景色');
    const gen = parent.xiaobaixStreamingGeneration;
    const timer = setInterval(() => {
      const s = gen.getStatus(id);
      document.getElementById('out').textContent = s.text || '生成中...';
      if (!s.isStreaming) clearInterval(timer);
    }, 200);
  })();
</script>
```

生成完成时会发出 `xiaobaix_streaming_completed` 消息，内容是 `{ finalText, originalPrompt, sessionId }`。网页里可以这样接收：

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'xiaobaix_streaming_completed') {
    console.log(e.data.payload.sessionId, e.data.payload.finalText);
  }
});
```

想在网页里直接调用 AI、自己处理每段输出，用 [`callGenerate`](render.md#callgenerate在网页里调用-ai) 更直接。

## 注意事项

- 生成结果不会写进聊天记录；需要保存就自己存到变量里。
- 中止生成时不会报错，已生成的部分会保留在会话里。
- 关闭小白X总开关时，正在进行的生成会被中止。

## 常见问题

### 命令没有任何反应

- 流式模式下命令只返回编号，屏幕上不会出现文字。想直接看到结果请加 `nonstream=true` 并接 `| /echo`。
- `/xbgen` 后面必须有提示文字；`/xbgenraw` 至少要有提示文字或结构参数之一。

### 报错信息

| 提示 | 原因与处理 |
| --- | --- |
| `未检测到当前模型…` | 酒馆里还没选模型。在 API 连接面板选好模型，或在命令里写 `model=` |
| `不支持的 api: …` | `api` 参数写错了，可选值见[通用参数](#通用参数) |
| `未配置自定义后端URL…` | 用了 `api=custom` 但没有地址。在命令里写 `apiurl=`，或在酒馆里填好自定义地址 |
| `输入过长：…` | 内容超出了模型上下文长度。少带一些 `addon`，或调小 `{$historyN}` 的数字 |
| `请求被配额或限流拒绝：…` | API 额度用完或请求太频繁，稍后再试或换个密钥 |
| `请求被上游 API 以 Bad Request 拒绝。…` | 参数或模型名不被接口接受，检查 `model` 和采样参数 |

流式模式下的出错不会弹出提示，可以在[监控台](tools.md#监控台)的日志里查看。
