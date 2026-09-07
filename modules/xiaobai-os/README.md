# 小白 OS（普通酒馆）

普通酒馆的小白 OS 是一项全新、独立功能。它可以与小白酒馆 Phone OS 使用相近的品牌和交互，但两者不共享数据库、会话、消息层级、领域模型或运行时代码。

## 终态边界

    SillyTavern 扩展入口
    └─ modules/xiaobai-os
       ├─ kernel/               分区事务、Capability、APP 生命周期与故障隔离
       ├─ storage/              sidecar 文件、聊天引用与 SillyTavern 文件适配
       ├─ capabilities/         Economy、Agent、Maintenance 的窄能力
       ├─ host/                 SillyTavern 生命周期、薄组合入口与 frame 协议
       ├─ shell/                OS 外壳、桌面和 APP 路由
       ├─ domains/<domain>/     领域模型、事件、不变量和纯投影
       └─ apps/<app>/           应用服务、Controller、DTO 和 UI

- modules/tavern 不在依赖图中。
- kernel 不拥有钱包、银行、游戏、商店、地图或任务规则。
- 每个功能自带领域模型、应用服务、Prompt/工具（需要时）和 UI，通过 APP module 注册。
- 普通聊天内容不是 Economy 的数据源。Economy、Wallet、Game、Bank、Shop 不做剧情哈希、核对或回滚。
- Map、Tasks 的自动维护由各自领域状态机处理，不向 Economy 添加全局剧情机制。

底座唯一权威设计见 [OS Kernel 终态设计](./docs/os-kernel-target-design.md)，施工顺序见 [OS Kernel 施工方案](./docs/os-kernel-implementation-plan.md)。

## 当前 APP

- 四次元壁：独立的皮下会话与实时吐槽，按请求读取当时的主聊天上下文。
- 钱包：Economy 的只读余额和流水界面。
- 银行：定期存单与浮动理财；期限只读取当前已完成 Assistant 回复数量。
- 游戏：目录式游艺室，大话骰、翻牌寻金、步步登高；各玩法独立入席、操作和揭晓，与聊天内容完全无关。
- 商店：固定商品、库存、效果激活和主 RP Prompt 投影；用回复消息收据记录有限效果实际作用次数。
- Agent API：编辑 agent-core 的共享用户级配置。
- 地图：独立 Atlas/Scene 与显式/自动维护。
- 任务：任务大厅、招募、状态机、奖励托管与显式/自动维护。

不明物与宠物尚未进入设计，不注册占位入口。

信息 APP 已接入桌面与独立 `messages` 分区：已知人物/手动补充、私人通讯、线程摘要、文字/图片/语音、共用真实「私人信息」楼层及保存恢复。图片输入为画面描述，语音输入为原文，共享画图/TTS 负责呈现，不含上传识图或录音转写。边界和验收见[终态设计](./docs/information-app-target-design.md)与[施工方案](./docs/information-app-implementation-plan.md)。本次不删除小白板或迁移旧短信。

世界 APP 尚处于设计讨论，见[世界 APP 设计草案](./docs/world-app-target-design.md)。当前只讨论 APP 自身的轻背景与世界近况；OS 内联动、ENA 适配及小白板退场另行讨论，尚未实现或注册入口。

## 数据与写入

当前聊天的 OS 业务数据终态保存在：

    /user/files/LittleWhiteBox_OS_<osId>.json

聊天 metadata 只保存 formatVersion + osId 的 xiaobaiOsRef，不保存 APP 业务。Sidecar Envelope 只认识 opaque partitions；各 APP 解析自己的分区。

Economy 分区流水是余额的唯一事实来源。Bank、Game、Shop、Tasks 只持久化自己的事件，并通过 Economy Capability 在同一个 sidecar candidate 中完成业务事件与资金流水。

保留的通用安全能力：

- 稳定 osId 与可变聊天 binding 分离；
- 单页面 sidecar 写队列及每次写前强读；
- revision/eventId CAS；
- actionId 幂等；
- 跨分区单文件原子提交；
- commitId 超时读回确认；
- 分区数据与写入状态的运行时通知。

编辑、swipe 或删除消息不会删除已提交的经济、银行、游戏或商店事实。SillyTavern 分支建立独立 osId，默认复制已确认 partitions；Messages 自行按子聊天可核实的私人信息标记裁剪历史，防止未来私聊及摘要进入子线。此后两条世界线独立推进，OS 不按消息前缀猜测经济时点。

## APP 打开行为

- 未进入单聊或群聊时，点击 OS 只提示“请先进入聊天，再打开小白 OS。”，不创建窗口。已有聊天但尚无 sidecar 可以正常打开。
- Shell 静态保留所有已交付 APP 图标；Host、分区或 UI 失败时进入该 APP 的错误页并可重试。
- UI 组件点击后动态加载；一个 APP chunk 或 runtime 失败不关闭 OS。
- 打开、切聊、重新聚焦强读当前 sidecar；每次写事务前再次强读。
- 保存结果未确认时保留同一 candidate 并冻结该聊天的新写入，不重新执行领域命令。
- 打开 APP、关闭自动维护开关和普通本地查看不会调用 Agent。

## 注册与删除

薄宿主组合只注册 Storage Port、Capabilities 与 Host APP catalog；Shell catalog 独立注册静态图标和 UI loader。删除一个业务 APP 的标准路径是：先确定未结资金/效果的数据策略，再删除对应 apps 与 domains、删除 Host/Shell 两处 catalog 项、清理对应分区；不保留永久兼容壳。

## 当前底座状态

生产组合已经切换到 Kernel/sidecar。聊天 metadata 只保留`xiaobaiOsRef`；测试线旧 OS 业务根不读取、不迁移。upstream 已上线的 Fourth Wall `fw`是唯一旧业务兼容对象，由 Fourth Wall 自有升级入口在首次 sidecar 提交时导入。

新 APP 必须按上述 module、partition 与 Capability 边界接入；不得重新建立集中业务根或绕过 Kernel 直接写其他 APP 数据。

## 验证

    npm run test:xiaobai-os
    npm run lint:xiaobai-os
    npm run build:xiaobai-os
