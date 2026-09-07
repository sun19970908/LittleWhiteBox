# SillyTavern 与 LittleWhiteBox 项目结构参考

本文档是目录导航，不是完整文件清单。它只回答“一个能力属于哪层、从哪里进入”；进入对应模块后，用 `Glob` 按路径找文件、`Grep` 按内容找文件，或读取该模块自身的 README / 架构文档定位具体实现。新增普通内部文件不需要更新本文档。

你当前所在的是 SillyTavern 前端里的一个第三方插件：

- SillyTavern 根目录包含整站代码与运行配置，`public/` 是前端静态资源根目录。
- `public/scripts/` 是酒馆前端脚本主区域，`public/scripts/extensions/third-party/` 是第三方插件目录。
- LittleWhiteBox 的磁盘物理位置是 `public/scripts/extensions/third-party/LittleWhiteBox/`。
- 工具读取路径不带 `public/`：LS / Glob / Grep / Read 使用 `scripts/extensions/third-party/LittleWhiteBox/...`。

## SillyTavern 结构心智

```text
SillyTavern/
├── config.yaml                  # 酒馆主配置
├── data/                        # 运行数据、用户数据与配置存档
├── plugins/                     # 服务端插件生态，不是前端 third-party 扩展
├── public/
│   ├── index.html               # 前端入口
│   ├── css/、img/               # 全局静态资源
│   └── scripts/
│       ├── script.js            # 酒馆前端主入口之一
│       ├── extensions/          # 扩展系统；LittleWhiteBox 位于 third-party/
│       ├── slash-commands/      # 斜杠命令
│       └── openai.js、anthropic.js、group-chats.js、power-user.js 等宿主能力
├── src/                         # 酒馆后端源码
├── server.js                    # 服务端入口之一
└── package.json                 # 依赖与脚本
```

LittleWhiteBox 是挂在酒馆扩展系统中的前端插件，不是独立网站或外部 SaaS。当前可直接查证的重点是插件自身和酒馆前端脚本；服务端实现、数据库、容器、Node 进程或后端路由需另行查证，不能假装已知。

## LittleWhiteBox 导航树

```text
LittleWhiteBox/
├── index.js                     # 插件总入口：模块初始化、设置绑定、启停与统一 facade
├── manifest.json、package.json  # 插件清单、依赖与脚本
├── settings.html、style.css     # 主设置页与全局样式
├── vite.*.config.mjs            # 各独立前端 bundle 的构建配置
├── scripts/                     # 构建、manifest、导入与质量检查脚本
├── bridges/                     # 酒馆上下文、世界书、生成服务与 iframe 桥接
├── core/                        # 与业务无关的事件、存储、命令、路径、消息通信原语
├── shared/                      # 跨模块共享的宿主 LLM 与通用工具
├── libs/                        # 随插件分发的第三方库与 wasm
├── docs/                        # 许可证、版权与第三方声明
└── modules/                     # 业务模块
    ├── agent-core/              # 多 Agent App 的共享配置、适配器、协议、工具原语
    │   ├── README.md            # agent-core 的所有权边界
    │   ├── browser-entry.js     # 浏览器 bundle 的无业务入口
    │   ├── adapters/            # 直连与 SillyTavern provider 适配器
    │   ├── runtime/             # 协议、上下文、子任务、流式等通用运行原语
    │   ├── tools/               # 不认识具体 App 路径的文本/patch 工具原语
    │   ├── ui/                  # 跨 App 复用、无业务状态的配置与展示原语
    │   └── dist/                # 供浏览器懒加载的构建产物
    ├── assistant/               # 小白助手：宿主窗口、iframe App、local 工作区与 JS API
    │   ├── ARCHITECTURE.md      # 助手自身的分层、依赖方向与扩展规则
    │   ├── assistant.js         # 宿主桥接、工具派发、存储/设置/JS API 接线
    │   ├── assistant-host-window.js、assistant-overlay.html
    │   ├── app-src/             # iframe 装配；按 context、memory、prompts、runtime、state、ui、workspace 分层
    │   ├── shared/              # assistant 专属 session 与 local workspace；少数 agent-core 迁移壳
    │   ├── runtime-src/         # JS API 运行时生成源
    │   ├── dist/                # iframe 与 JS API 构建产物
    │   ├── tests/               # 助手公开行为与边界测试
    │   └── references/          # 本文档及 SillyTavern / STscript 参考
    ├── xiaobai-os/              # 普通 SillyTavern 的独立 TypeScript OS
    │   ├── index.ts、agent/     # 宿主组合入口与 OS Agent 浏览器入口
    │   ├── capabilities/        # 共享 Agent gateway 与接受轮维护编排
    │   ├── apps/                # 每个桌面 APP 自己的模块、服务、Controller 与 Vue UI
    │   │   └── agent-api、fourth-wall、wallet、shop、bank、game、map、messages、tasks
    │   ├── domains/             # 领域状态、不变量、纯规则与数据投影
    │   │   └── economy、shop、bank、game、map、messages、tasks
    │   ├── host/、kernel/       # ST 适配、生命周期、scoped 存储与事务边界
    │   ├── shell/、storage/     # OS 桌面/APP catalog、sidecar 与聊天持久化适配
    │   ├── docs/、tests/、dist/ # 设计文档、验证与构建产物
    ├── tavern/                  # Tavern 面板：Vue + TypeScript + Vite 的酒馆运行/调试界面
    │   ├── tavern.ts、tavern.js、tavern.html
    │   ├── app-src/             # App、components、features、manager/runtime 与样式
    │   │   └── features/phone-os/ # Phone OS 注册、路由、领域同步与 APP Controller
    │   ├── host/、shared/       # ST 适配；会话/Manager/地图/经济/任务等共享领域
    │   └── docs/、tests/、dist/
    ├── ebook/                   # 小白电纸书：书架、阅读器、创作台与 book/... 工作区
    │   ├── ebook.js、ebook.html # 宿主与 iframe 入口
    │   ├── host/、app-src/      # 素材导入/桥接；iframe 组装、创作与阅读 UI
    │   └── shared/、tests/、dist/ # book 数据、工具运行时、验证与产物
    ├── draw/                    # AI 画图：跨 Provider 共享规划/图库与具体画图后端
    │   ├── shared/              # 场景规划、Prompt、缓存、队列、世界书和图库能力
    │   └── providers/           # NovelAI、SD WebUI、ComfyUI 的 UI、请求与提示词
    ├── story-summary/           # 剧情总结与向量记忆
    │   ├── story-summary.*      # 入口、iframe UI 与样式
    │   ├── data/、generate/     # 配置/存储与总结生成链
    │   └── vector/              # 抽取、索引、召回、存储与 worker runtime
    ├── ena-planner/             # 发送前剧情规划器与规划 UI
    ├── story-outline/           # 故事大纲生成
    ├── scheduled-tasks/         # 定时与内嵌任务
    ├── variables/               # 变量面板、命令、事件与 state2 引擎
    ├── tts/                     # 语音 Provider、缓存、播放与消息语音投影
    ├── debug-panel/、template-editor/
    ├── control-audio.js、iframe-renderer.js、immersive-mode.js
    ├── message-media/、plugin-update/  # 外层仍独立注册的功能模块
    └── message-preview.js、streaming-generation.js
```

## 小白助手补充入口

- 助手自身的分层、session、`[Current context]` / `[Current plans]`、`Plan*` / `DelegateRun`：`modules/assistant/ARCHITECTURE.md`。
- STscript 语法、参数系统、转义规则与具体命令：`modules/assistant/references/stscript-reference.md`。
- SillyTavern 前端 API：`modules/assistant/references/sillytavern-javascript-api-reference.md`。
- 具体代码文件：先进入上方对应职责目录，用 `Glob` 按路径模式查找，或用 `Grep` 按名称/符号检索；不要把本导航树当作文件清单。
