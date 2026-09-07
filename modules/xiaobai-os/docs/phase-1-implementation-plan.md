# 普通酒馆小白 OS 第一阶段实施说明

- 状态：**已封存，不得继续照此施工**。本文只记录旧 metadata 根阶段的第一版实现，其中 chat metadata repository、完整 OS 根和静态总装指令均已失效；当前底座以 [OS Kernel 终态设计](./os-kernel-target-design.md) 和 [OS Kernel 施工方案](./os-kernel-implementation-plan.md) 为准。待 Kernel 切换完成，本历史文档可删除。
- 当前整体状态见[终态设计与开发规划](./target-design-and-roadmap.md)
- 依据：[终态设计与开发规划](./target-design-and-roadmap.md)
- 第一阶段范围：独立 OS 壳、四次元壁 APP、正式线数据迁移
- 技术基线：运行时源码使用 TypeScript/Vue，`strict: true`

## 1. 第一阶段交付边界

第一阶段只交付普通 SillyTavern 的小白 OS 和四次元壁 APP。它与`modules/tavern/**`中的小白酒馆 Phone OS 不共享领域模型、数据库、会话、楼层或运行时代码。

用户可观察结果：

1. 扩展设置只有一个“小白 OS”开关。
2. 开启后，发送键左侧只有一个 OS 图标。
3. 点击图标先进入 OS 桌面，再进入四次元壁。
4. 四次元壁保留会话、生成、设置、图片、语音和实时吐槽能力。
5. 每个普通聊天只读取自己的`chat_metadata`数据。
6. 关闭窗口、切换聊天或停用功能时，旧异步任务不能写入新聊天。
7. 正式线上游四次元壁数据只在升级边界迁移一次，日常运行只认现行模型。

地图、钱包、银行、游戏、任务和宠物不属于第一阶段，不注册图标或空页面。

## 2. 开工前边界结论

| 问题 | 第一阶段结论 |
|---|---|
| 功能所有者 | `modules/xiaobai-os`拥有 OS；`apps/fourth-wall`拥有四次元壁 |
| 唯一事实来源 | 全局配置为`extension_settings...xiaobaiOs`；聊天数据为当前`chat_metadata...xiaobaiOs` |
| 临时态 | 窗口、路由、请求、流式片段、媒体句柄、冷却和 UI 展开状态 |
| 持久态 | OS 开关、APP 配置、四次元壁会话与历史 |
| 外部依赖 | SillyTavern context/events/metadata、Agent Core、Draw、TTS、iframe 通讯 |
| 注册入口 | 根`index.js`只加载`dist/xiaobai-os-host.js`；设置页只有一个 OS 开关 |
| 删除路径 | 删除 OS 目录、构建配置、根注册和两个`xiaobaiOs`数据根 |
| 兼容对象 | upstream 现有四次元壁设置与当前聊天`fw`数据、SillyTavern、浏览器/WebView |
| 最少测试 | legacy fixture 迁移、仓库隔离与回滚、生命周期取消、可信消息、四次元壁领域行为、类型检查与构建 |

普通主聊天中的`[img:]`和`[voice:]`增强分别属于 Draw 与 TTS，不属于 OS。删除 OS 不应删除这两项能力。

## 3. TypeScript 边界

第一阶段运行时源码只有两种形式：

- `.ts`：宿主、数据仓库、迁移器、生命周期、四次元壁领域/运行时/Agent。
- `.vue`：OS 壳和四次元壁界面，`<script setup lang="ts">`。

允许存在的 JavaScript：

- `modules/xiaobai-os/dist/*.js`：Vite 生成的浏览器产物，不是手写源码。
- `modules/xiaobai-os/tests/*.test.js`：Node 行为测试，通过`tsx`加载 TypeScript 源码。
- OS 目录外的 SillyTavern 与 LittleWhiteBox 既有 JavaScript 依赖。

`tsconfig.xiaobai-os.json`启用`strict: true`。`allowJs: true`只用于读取目录外既有 JS 依赖的导出形状，`include`仍只纳入 OS 的 TypeScript、Vue 和声明文件；OS 自身的运行时源码不得退回 JS。

TypeScript 源码中的相对 import 保留`.js`后缀，以符合浏览器 ESM 输出；`moduleResolution: Bundler`会在开发期把这些 specifier 解析到对应`.ts`源文件。

## 4. 第一阶段交付时的源码结构

```text
modules/xiaobai-os/
├─ index.ts                         # 唯一宿主组合入口
├─ host/
│  ├─ lifecycle.ts                 # 图标、窗口、APP 生命周期
│  ├─ frame-bridge.ts              # 可信 iframe 边界
│  ├─ sillytavern-context.ts       # SillyTavern adapter/DTO
│  ├─ agent/                       # 统一 Agent Core gateway 与 bundle loader
│  ├─ settings-repository.ts       # 全局设置唯一写入口
│  ├─ chat-metadata-repository.ts  # 当前聊天数据唯一写入口
│  └─ legacy-migration.ts          # 一次性上游迁移与现行校验
├─ agent/browser-entry.ts          # OS 共用 Agent bundle 入口
├─ shell/app-src/                  # Vue/TypeScript OS 桌面与导航
├─ apps/agent-api/                 # 共享 Agent 设置系统 APP
├─ apps/fourth-wall/
│  ├─ types.ts                     # APP 跨层数据契约
│  ├─ domain/*.ts                  # 默认值、状态转换、Prompt、结果投影
│  ├─ host/*.ts                    # Controller、生成适配、吐槽与媒体
│  └─ ui/*.vue                     # APP 界面
├─ tests/*.test.js                 # 公开行为测试
└─ dist/                           # 构建产物
```

依赖方向：

```text
根 index.js
    ↓ dist/xiaobai-os-host.js
index.ts → host lifecycle/composition → 各 APP host/controller → 各自 domain/types
                         │                     │
                         └→ host/agent gateway ←┘（仅需模型的 APP）
                                  ├→ agent-core 共享设置仓库
                                  └→ dist/xiaobai-os-agent.js → agent-core 供应商实现

shell Vue ←可信 iframe 协议→ host lifecycle/controller
```

OS 壳不知道四次元壁会话字段；四次元壁不直接读写 SillyTavern 全局对象；repository 不依赖 Vue。

## 5. 数据与异步契约

全局设置由`settings-repository.ts`独占写入：

```text
extension_settings.LittleWhiteBox.xiaobaiOs
```

当前聊天数据由`chat-metadata-repository.ts`独占写入：

```text
chat_metadata.extensions.LittleWhiteBox.xiaobaiOs.apps.fourthWall
```

仓库 mutation 必须接收完整旧状态并返回完整新状态；保存前重新核对聊天 identity。保存前明确失败时恢复旧对象；SillyTavern 已尝试保存但读回未确认时保留候选对象，避免下一次写入用旧数据覆盖可能已成功的服务端结果。UI、Controller 和迁移器都不能绕过 repository 直接持久化。

前台生成、图片、语音和吐槽任务绑定当前 activation/chat/session/request。关闭窗口、切换会话、切换聊天或 cleanup 时，先使旧 generation 失效，再取消外部任务；迟到结果只能丢弃。

## 6. 正式线迁移

需要兼容的旧设置只有 upstream 已存在字段：

```text
fourthWall
fourthWallImage
fourthWallVoice
fourthWallCommentary
fourthWallPromptTemplates
dynamicPrompt
```

需要兼容的旧聊天数据只有：

```text
chat_metadata[currentChatId].extensions.LittleWhiteBox.fw
```

迁移由冻结 fixture 证明。确认保存成功后删除旧分支；保存前明确失败时恢复旧分支，保存已经发起但读回未确认时保留内存候选与迁移后的分支并报告。日常 repository 不双读旧字段。停止支持从该 upstream 版本直接升级时，迁移器、旧字段规则和 fixture 一并删除。

## 7. 三个构建入口

`npm run build:xiaobai-os`依次执行：

1. `vue-tsc --noEmit -p tsconfig.xiaobai-os.json`
2. 构建 iframe 壳
3. 构建宿主
4. 构建四次元壁 Agent

产物：

```text
modules/xiaobai-os/dist/xiaobai-os-app.js
modules/xiaobai-os/dist/xiaobai-os-app.css
modules/xiaobai-os/dist/xiaobai-os-host.js
modules/xiaobai-os/dist/xiaobai-os-agent.js
```

宿主 bundle 只合并 OS 自有源码；SillyTavern、根`core/`和通用`modules/agent-core/`保持外部依赖，并由构建配置按`dist/`位置重写相对路径。Agent bundle 独立打包通用 Agent 能力。共享密钥只在用户打开 Agent API 系统 APP 时随该 APP 的可信状态下发；桌面状态及四次元壁等业务 APP 均不接收密钥。

## 8. 自动验收

必须通过：

```text
npm run test:xiaobai-os
npm run test:tauritavern-chat-surface
npm run build:xiaobai-os
npm run build:assistant:manifest
npm run lint
git diff --check
```

这些检查分别保护数据迁移/隔离、生命周期与请求失效、托管聊天表面约束、TypeScript/Vue 契约、浏览器产物和静态边界。它们不能替代真实浏览器中的 SillyTavern 事件时序与供应商调用。

已完成的真实 SillyTavern 浏览器验收：

- OS 开关、发送栏图标、桌面、四次元壁 Default 会话、返回、主页和关闭正常。
- 四次元壁设置、Prompt 编辑器和 Agent 配置可加载到 SillyTavern 的真实 Provider 表单。
- `chat_id_changed`会关闭 OS 窗口且保留已启用的入口，旧页面不会继续占用当前聊天。
- 聊天元数据保存后可从`/api/chats/get`读回现行`schemaVersion`和`activeSessionId`。
- 验收产生的聊天元数据和开关状态均已清理并读回确认。

## 9. 删除路径

删除小白 OS 时：

1. 删除`modules/xiaobai-os/`、`tsconfig.xiaobai-os.json`和`vite.xiaobai-os.config.mjs`。
2. 删除根`index.js`中的宿主产物 import/注册以及`settings.html`中的唯一开关。
3. 删除全局与当前聊天的`xiaobaiOs`数据根。
4. 保留 Draw/TTS 的普通聊天媒体增强。

删除四次元壁 APP 时，只删除`apps/fourth-wall/`、APP 注册、对应数据分支和 legacy 迁移；OS 壳继续存在。

## 10. 第一阶段之外

后续 APP 必须先回答自己的领域所有者、持久态、是否读取普通聊天及所需的最窄事实、失败恢复和删除路径，再加入注册表。第一阶段不预埋共享钱包、地图状态、任务总线、宠物表或 Tavern 数据桥。
