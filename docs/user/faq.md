# 常见问题

这里收集安装、更新和日常使用中最常遇到的问题。找不到答案时，看最后的 [还是没解决](#还是没解决)。

## 安装与更新

小白X 的仓库地址是 `https://github.com/RT15548/LittleWhiteBox`，安装方法见 [安装与更新](index.md#安装与更新)。安装或更新失败时，酒馆右上角会弹出 `Extension installation failed` 或 `Extension update failed`，下面是提示里常见的内容。

### Directory already exists at …LittleWhiteBox

酒馆里已经有一个 `LittleWhiteBox` 文件夹，通常是之前装过或装到一半失败了。

1. 关闭酒馆。
2. 打开酒馆目录下的 `public/scripts/extensions/third-party/`，删除 `LittleWhiteBox` 文件夹。
3. 启动酒馆，重新安装。

### spawn git ENOENT

电脑上没有安装 Git，或者酒馆找不到它。

1. 安装 Git（Windows 可以从 `https://git-scm.com/download/win` 下载），安装时选择把 Git 加入 PATH。
2. 打开终端运行 `git --version`，能看到版本号就说明装好了。
3. 重启酒馆，重新安装。

### Failed to connect to github.com port 443

你的网络连不上 GitHub。换一个能访问 GitHub 的网络，或者给酒馆所在的电脑配置代理后再试。

### Could not resolve host

提示里的地址无法访问，通常是用了旧的或错误的仓库地址。在酒馆的扩展管理里删除小白X，再用 `https://github.com/RT15548/LittleWhiteBox` 重新安装。

### Internal Server Error. Check the server logs for more details.

酒馆在安装或更新时出错了，具体原因写在运行酒馆的终端窗口里。常见做法是：在扩展管理里删除小白X，再重新安装。仍然失败，把终端里的报错发给别人求助。

### 小白X 里的更新按钮

小白X 设置里也能直接更新，提示“小白X更新失败”时的处理见 [插件更新](tools.md#插件更新)。

## 版本要求

小白X 支持 SillyTavern 1.14 及以上版本。

其中 [小白酒馆](tavern.md) 需要 1.14.0 或更高。版本过低时点 `小白酒馆` 会提示“小白酒馆需要 SillyTavern 1.14.0 或更高版本。当前版本过低，其他小白 X 功能仍可正常使用。”，升级酒馆即可。

## 用不了

### 设置里的按钮是灰的，或者功能没反应

先确认 **扩展设置 → 小白X** 最上方的 `启用小白X` 已勾选。总开关关闭时，小白X 的所有功能都会停用，`小白助手`、`电纸书`、`小白酒馆` 按钮也会变灰。

再确认对应功能自己的开关已打开。不确定哪些开关该开，可以点 `默认开关` 恢复，见 [默认开关](tools.md#默认开关)。

### 发送栏里没有小白 OS 按钮

见 [小白 OS 常见问题](xiaobai-os.md#发送栏里没有-小白-os-按钮)。

### 小白助手、电纸书打开失败

会提示“小白助手初始化失败”或“电纸书初始化失败”。刷新页面后再试；仍不行，打开 [监控台](#监控台) 看错误。

### 模型没有回复、提示连接失败

小白助手、电纸书、小白酒馆、小白 OS 共用一份模型配置。到 [小白助手的 API 配置](assistant.md#api-配置) 检查地址、Key 和模型，点 `拉取模型` 看接口通不通。小白 OS 的 `Agent API` 应用里也可以 `测试当前连接`。

### 联网提示要填 Key，或需要后端

- “请填写所选联网渠道的 API Key”：在 [联网设置](assistant.md#联网) 里给所选渠道填 Key。
- “Exa 联网需要小白盒后端”：安装 [小白X 后端](server.md)，或改用 Tavily。

## 排查问题的入口

### 监控台

点 **扩展设置 → 小白X** 里 `启用小白X` 旁边的 `监控` 按钮，打开 `小白X 监控台`。`日志` 标签里能看到最近的报错。用法见 [监控台](tools.md#监控台)。

### 查看发给模型的内容

想知道某次回复到底收到了什么提示词，用 [消息日志与拦截](tools.md#消息日志与拦截)。小白酒馆里用 [请求日志](tavern.md#请求日志)。

### 问小白助手

[小白助手](assistant.md) 能读小白X 和酒馆的源码与文档。把报错原文贴给它，它会帮你查原因。

## 还是没解决

到 GitHub 提问：`https://github.com/RT15548/LittleWhiteBox/issues`。

提问时附上：

- SillyTavern 版本和小白X 版本。
- 你做了什么、期望看到什么、实际看到什么。
- 监控台里的报错，或运行酒馆的终端里的报错。

更多求助时要提供的信息，见 [向别人求助时该提供什么](tools.md#向别人求助时该提供什么)。
