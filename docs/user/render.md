# 代码块渲染

AI 回复或角色卡里用 ```` ``` ```` 包起来的 HTML，小白X会把它变成一块能点、能动的小网页，直接显示在楼层里。本页还介绍网页里可以调用的函数，以及播放网络音频的 `/xbaudio` 命令。

## 启用功能

**扩展设置 → 小白X → 渲染交互**

| 设置 | 默认 | 说明 |
| --- | --- | --- |
| `启用小白X` | 开 | 总开关。关掉后小白X所有功能都停用，下面的设置也会变灰 |
| `渲染开关` | 开 | 关掉后，已经渲染出来的网页全部清掉，楼层里重新显示原始代码；再打开会马上重新渲染 |
| `渲染楼层` | 5 | 只渲染最近这么多层楼里的代码块，范围 1–9999 |
| `启用Blob渲染` | 关 | 换一种方式加载网页，适合很大的 HTML，见[Blob 渲染](#blob-渲染) |

## 哪些代码块会被渲染

代码块里的内容满足下面任意一条，就会被渲染成网页：

- 含有 `<!DOCTYPE`、`<html` 或 `<script`（不分大小写）；
- 直接以常见 HTML 标签开头，比如 `<div>`、`<style>`、`<svg>`、`<canvas>`、`<table>`、`<section>`、`<button>`、`<p>`、`<span>`、`<h1>`～`<h6>` 等（前面有 HTML 注释也可以）；
- 整个代码块只有一个 `http://` 或 `https://` 网址；
- 含有一行 `<!-- xb-src: 网址 -->`，表示加载这个网址的页面。

其他代码块（比如普通的 JS、Python 代码）保持原样显示。

最简单的例子，让 AI 输出或者在角色卡开场白里写：

````text
```html
<div style="padding:12px;border-radius:8px;background:#2b2b3a;color:#fff">
  <b>状态栏</b>
  <p>生命：80 / 100</p>
  <button onclick="STscript('/echo 你点了按钮')">点我</button>
</div>
```
````

渲染后，原来的代码块会被隐藏，换成这块小网页。网页高度会跟着内容自动调整，不用自己设。

### 什么时候渲染

- AI 正在流式输出时，最新这层楼先显示原始代码，生成结束后再渲染，避免半截 HTML 闪烁。
- 编辑、滑动切换（swipe）一层楼后，这层楼会重新渲染。
- 切换聊天后，所有楼层重新渲染。

## 渲染楼层

只有最近 N 层楼会渲染（N 就是 `渲染楼层`，默认 5）。更早的楼层会自动退回原始代码块，这样聊天很长时也不会卡。

改小这个数字，超出范围的楼层会马上退回原始代码；改大则在之后的渲染中生效。填了无效的数字会被改成 1。

## Blob 渲染

默认情况下，HTML 直接写进网页框里。勾选 `启用Blob渲染` 后，改为先把 HTML 存成一个临时文件再加载，适合体积很大的 HTML。开启后网页里的相对路径会按酒馆地址解析，例如 `src="img/a.png"` 指向酒馆根目录下的 `img/a.png`。

如果某张卡在 Blob 模式下显示异常，关掉这个选项再试。

## 加载外部网页

整个代码块只写一个网址，就会把那个网页显示在楼层里：

````text
```text
https://example.com/game.html
```
````

读取期间框里显示“加载中...”。插件会先尝试读取网页内容并像普通 HTML 一样渲染；读取失败（例如对方网站不允许跨域读取）时，改为直接把网址嵌进来，最小高度 800 像素，可以在框里滚动。这种直接嵌入的网页拿不到下面介绍的函数。

## 网页里可以用的函数

渲染出来的每个网页里，小白X都会预先放好下面这些函数。写卡时直接调用即可。

| 名字 | 作用 |
| --- | --- |
| `STscript(命令)`（也可写 `stscript`） | 让酒馆执行斜杠命令，返回 Promise，结果是命令的输出 |
| `callGenerate(选项)`（也可写 `CallGenerate`） | 用当前聊天补全 API 生成一段文字 |
| 头像样式 | 显示用户和角色的头像 |

沉浸式模板渲染出的网页还多两个函数，见[模板网页里的额外函数](template.md#模板网页里的额外函数)。

### STscript：执行酒馆命令

```js
// 不写开头的 / 也可以，插件会自动补上
await STscript('/echo 你好世界！');

// 读取变量
const hp = await STscript('/getvar 生命');

// 出错时会抛出异常
try {
  await STscript('/setvar key=生命 90');
} catch (e) {
  console.error('命令失败', e.message);
}
```

- 命令里的宏会先被替换；能解析成 JSON 的结果会自动解析，比如返回 `"5"` 会得到数字 `5`。
- 命令执行出错时 Promise 会失败，`e.message` 是原因。
- 180 秒没有结果会以 `Command timeout` 失败。

把玩家输入直接拼进命令（例如 `STscript('/send ' + 文本)`）时，文本里的 `|`、`{{…}}` 会被当成命令语法处理。只在确实要执行命令时这样写，并按酒馆的 STscript 规则转义参数。

### callGenerate：在网页里调用 AI

```js
const res = await callGenerate({
  components: { list: ['ALL_PREON'] }, // 带上当前预设里已开启的全部条目（含聊天记录、世界书）
  userInput: '用一句话总结目前的剧情',
  streaming: {
    enabled: true,
    onChunk(chunk, accumulated) {
      document.querySelector('#out').textContent = accumulated;
    },
  },
});
console.log(res.result);
```

| 选项 | 说明 |
| --- | --- |
| `userInput` | 作为最后一条用户消息发送 |
| `components: { list: ['ALL_PREON'] }` | 带上当前预设已启用的全部条目。不写 `list` 时不带任何预设内容 |
| `injections` | 额外插入的消息，例如 `[{ role: 'system', content: '…', position: 'IN_CHAT', depth: 0 }]`。`position` 可选 `BEFORE_PROMPT`、`IN_PROMPT`、`IN_CHAT`、`AFTER_COMPONENT` |
| `streaming` | `enabled` 默认为 `true`（流式）；`onChunk(chunk, accumulated)` 每收到一段文字调用一次 |
| `preset` | 临时使用某个聊天补全预设 |
| `api: { overrides: { … } }` | 默认继承当前连接，可覆盖 `provider`、`model`、`temperature`、`maxTokens` 等 |

- 成功时返回 `{ success, result, sessionId, metadata }`，`result` 是生成的文字。
- 只支持聊天补全（Chat Completion）类 API。
- 失败时 Promise 会失败：`error.message` 是原因，`error.code` 是错误码（如 `API_ERROR`、`CANCELLED`、`INVALID_OPTIONS`），`error.details` 是附加信息。
- 300 秒没有完成会以 `Generation timeout` 失败。

只想在聊天里用命令生成文字，不写网页的话，用 [`/xbgen` 和 `/xbgenraw`](streaming.md) 更方便。

### 显示头像

网页里直接给元素加上类名，就能显示当前用户或角色的头像（36 像素圆形）：

```html
<span class="xb-user-avatar"></span>
<span class="xb-char-avatar"></span>
```

想自己定样式，可以用 CSS 变量 `--xb-user-avatar` 和 `--xb-char-avatar`：

```html
<div style="width:80px;height:80px;background:var(--xb-char-avatar) center/cover"></div>
```

### 获取聊天信息与酒馆事件

网页向父页面发送 `{ type: 'request-context' }` 或 `{ type: 'iframe-ready' }`，会收到一条 `type` 为 `st-context` 的消息，字段有 `chatId`、`characterId`、`characterName`、`userName`、`userPersona`、`userAvatar`、`msgIndex`（本网页所在楼层）、`swipeId`、`totalSwipes`、`totalMessages`、`isGroupChat`、`groupId`，都是只读快照。

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'st-context') {
    console.log('我在第', e.data.msgIndex, '层');
  }
});
parent.postMessage({ type: 'request-context' }, '*');
```

之后网页还会收到 `source` 为 `xiaobaix-host`、`type` 为 `st-event` 的消息，`event` 字段是酒馆事件名，包括 `message_sent`、`message_received`、`message_edited`、`message_swiped`、`message_deleted`、`chat_id_changed`、`chat_created`，这些会发给当前所有网页。`chat_deleted`、`group_chat_deleted`（`payload.chatId` 是不带 `.jsonl` 的聊天文件名）不会广播，而是攒着交给下一个发出 `iframe-ready` 的网页。

本网页所在楼层被编辑或滑动切换时，网页会重建，所以这些事件主要对其他楼层的网页有用。

### 写卡时的提醒

- 网页和酒馆在同一个页面源下运行，没有沙箱。`parent.SillyTavern.getContext()` 这类调用是能用的，但别人分享的卡片也同样能访问你的酒馆页面，只运行你信任的卡。
- 楼层被编辑、滑动切换或切换聊天时，网页会被销毁重建。不要从网页往父页面挂长期的监听、定时器或界面元素，它们不会随网页一起清除。需要长期运行的逻辑放进[循环任务](tasks.md)。
- 网页里写死的 `100vh` 高度会被改成按内容撑开（最少 600 像素），避免高度无限增长。

## `/xbaudio` 播放网络音频

在聊天框、快速回复、循环任务或网页里的 `STscript` 中都可以用。不需要额外开关，只要小白X总开关开着。

```text
/xbaudio https://example.com/bgm.mp3
```

默认循环播放，音量 5。

| 参数 | 可选值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `play` | `on` / `off` / `clear` | `on` | `off` 暂停，`clear` 停止并清掉当前曲目 |
| `mode` | `loop` / `once` | `loop` | 循环或只播一次 |
| `area` | `primary` / `secondary` | `primary` | 有两个独立的播放通道，可以一边放背景音乐一边放音效 |
| `volume` | 1–10 | 5 | 超出范围按 1 或 10 处理 |
| 网址 | `http://` 或 `https://` 开头 | — | 写 `list` 时返回该通道正在播放的网址 |

常用写法：

```text
/xbaudio mode=once area=secondary volume=8 https://example.com/click.mp3
/xbaudio list
/xbaudio play=off
/xbaudio play=off area=primary
/xbaudio play=clear
```

- `play=off` 或 `play=clear` 不写 `area` 时，对两个通道同时生效。
- 同一个通道再次播放同一个网址，会接着播放；换网址则从头播放新曲目。
- 切换聊天时，所有音频自动停止并清除。

命令会返回一段结果文字：

| 返回 | 含义 |
| --- | --- |
| `播放: 网址` / `继续播放: 网址` | 开始或继续播放 |
| `已停止` / `已全部停止` | 暂停了一个通道 / 全部通道 |
| `已清除` / `已全部清除` | 清除了一个通道 / 全部通道 |
| `错误: 仅支持 http/https 链接` | 网址格式不对 |
| `错误: 播放失败` | 浏览器无法播放，见下方常见问题 |

## 常见问题

### 代码块没有变成网页

- 确认 `启用小白X` 和 `渲染开关` 都勾选了。
- 看这层楼是不是在最近 `渲染楼层` 层以内。
- 检查代码块内容是否符合[哪些代码块会被渲染](#哪些代码块会被渲染)：以 JS 代码开头、或开头不是 HTML 标签时不会渲染。
- AI 还在生成时，最新楼层会先显示代码，等生成结束。

### 网页一片空白或功能不正常

打开[监控台](tools.md#监控台)看有没有报错。大型 HTML 可以试试 `启用Blob渲染`；反过来，开了 Blob 后异常就关掉试试。

### `/xbaudio` 返回“播放失败”

- 网址必须直接指向音频文件，而不是播放页面。
- 对方服务器可能不允许跨域访问，换一个音频地址试试。
- 浏览器可能要求你先和页面有过交互（点一下页面）才允许播放声音。
