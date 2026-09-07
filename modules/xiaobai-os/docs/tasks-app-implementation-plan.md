# Tasks APP 施工方案

## 1. 交付目标

本阶段一次性交付可用的普通 OS Tasks：领域状态机、世界 board、玩家发布/招募、Economy 托管结算、活动任务维护、主 RP 投影、自动维护设置和完整 UI。

Tasks 的业务步骤 A–G 已完成；其中旧 metadata 根、production composition 和 root validator 接法已被 Kernel 方案取代，不能继续照旧扩建。底座迁移按 [OS Kernel 施工方案](./os-kernel-implementation-plan.md) D3 执行，完成后本文只保留 Tasks 自有领域、Prompt、工具与 UI 契约。终态语义以[Tasks APP 终态设计](./tasks-app-target-design.md)为准。

## 2. 最终目录和职责

```text
modules/xiaobai-os/
├─ domains/tasks/
│  ├─ types.ts                 # 仅持久类型、公开投影与错误码
│  ├─ invariants.ts            # 当前 V1 严格校验、ID/文本/事件连续性
│  ├─ projection.ts            # 事件重放、列表/详情投影，不读 host
│  └─ commands/
│     ├─ create.ts             # accept / publish
│     ├─ recruitment.ts        # replace candidates / assign / cancel
│     └─ maintenance.ts        # progress / complete / fail
├─ apps/tasks/
│  ├─ module.ts                       # 分区、Capability、Host runtime 注册
│  ├─ application/
│  │  ├─ economy-protocol.ts   # Tasks 资金意图与 caller-bound Economy 交叉检查
│  │  ├─ ids.ts                # Tasks 私有 opaque ID factory；不依赖 Web Crypto
│  │  ├─ service.ts            # 对 Controller 的薄 facade
│  │  ├─ local-actions.ts      # 接取/发布/候选/选人/撤回分区事务
│  │  └─ maintenance-commit.ts # staged commands 批量原子提交
│  ├─ generation/
│  │  ├─ types.ts              # generation context/result 契约
│  │  ├─ context.ts            # 从 host 快照构造不可信数据投影
│  │  ├─ board-prompt.ts       # 世界 board system rules 与请求
│  │  ├─ candidate-prompt.ts   # 候选人 system rules 与请求
│  │  ├─ response-compiler.ts  # JSON 提取、逐项编译为无 ID draft、partial 结果
│  │  └─ request.ts            # 单 session/单轮/无工具请求与授权 token
│  ├─ maintenance/
│  │  ├─ prompt.ts             # active task 判定规则与只读数据块
│  │  ├─ tool-contract.ts      # 三个高层 JSON schema
│  │  ├─ command-compiler.ts   # 工具参数→staged command
│  │  ├─ result.ts             # 统一工具结果
│  │  └─ session.ts            # snapshot、每任务一次、CAS、commit/invalidate
│  ├─ host/
│  │  ├─ context-adapter.ts    # SillyTavern 卡片/persona/聊天/世界书快照
│  │  ├─ maintenance-participant.ts
│  │  ├─ prompt-runtime.ts     # 主 RP 只读任务投影
│  │  ├─ completion-runtime.ts # 已确认完成的酒馆通知；当前聊天内存去重
│  │  ├─ settings-runtime.ts     # 自动维护关闭时的即时执行栅栏
│  │  ├─ presentation.ts
│  │  └─ controller.ts
│  ├─ ui/
│  │  ├─ entry.ts                     # Shell 动态加载入口
│  │  ├─ TasksApp.vue          # 只负责 frame 协议、路由和页面组合
│  │  ├─ TasksBoard.vue
│  │  ├─ TasksActive.vue
│  │  ├─ TasksPublished.vue
│  │  ├─ TasksHistory.vue
│  │  ├─ TaskDetail.vue
│  │  ├─ TaskPublishForm.vue
│  │  ├─ TaskCandidateList.vue
│  │  ├─ TasksSettings.vue
│  │  └─ tasks.css
│  ├─ types.ts                 # iframe/host 可序列化消息类型
│  ├─ descriptor.ts
│  └─ README.md
└─ tests/
   ├─ tasks-domain.test.js
   ├─ tasks-application.test.js
   ├─ tasks-generation.test.js
   ├─ tasks-maintenance-participant.test.js
   ├─ tasks-controller.test.js
   └─ tasks-prompt-runtime.test.js
```

不得创建`tasks-manager.ts`、`tasks-system.ts`或同时拥有 Prompt、Agent 调用、状态机、资金和 UI 的大文件。通用 runner 不 import Tasks；Tasks 通过 participant 和 service 两个窄入口接入。

### 2.1 依赖方向

```text
domains/tasks                 <- 不 import apps/host/Vue/Economy
apps/tasks/application        <- domains/tasks + ScopedChatStore + Economy Capability
apps/tasks/generation         <- generation types + Agent Capability + application service interface；不直接读写 store
apps/tasks/maintenance        <- domains/tasks + application service + generic maintenance types
apps/tasks/host               <- application/generation/maintenance + SillyTavern adapter
apps/tasks/ui                 <- apps/tasks/types + frame bridge；不 import domain/application/host
apps/tasks/module + Host/Shell catalogs <- 唯一注册入口
```

`domains/tasks`不能知道余额、账户、iframe、Provider 或聊天消息。`economy-protocol.ts`只把 Tasks event 转成资金意图，并通过 caller-bound Economy 视图核对结果；它不能取得完整 Ledger 或 Envelope，Controller 也不手写资金腿。`generation/request.ts`只编排显式无工具请求，不能 import maintenance Session。`maintenance/session.ts`不读取 SillyTavern 或 Agent 配置。

### 2.2 领域命令接口

纯领域层只导出下列高层命令；不导出 JSON path、任意 patch 或可直接追加事件的 API：

```ts
interface TaskCommandEnvironment {
    now: () => number;
    createId: (kind: 'event') => string;
}

interface TaskCommandResult {
    domain: TaskDomainV1;
    event: TaskEvent | null;
    record: TaskRecord;
    changed: boolean;
}

replaceTaskBoard(domain, {
    expectedBoardId: string | null,
    boardId: string,
    listings: TaskListing[],
    generatedAt: number,
}): { domain: TaskDomainV1; board: TaskBoard };

acceptTaskListing(domain, {
    actionId, taskId, boardId, listingId, playerDisplayName, observedAssistantCount,
}, env): TaskCommandResult;

publishTask(domain, {
    actionId, taskId, form, playerDisplayName, observedAssistantCount,
}, env): TaskCommandResult;

replaceTaskCandidates(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, candidates, observedAssistantCount,
}, env): TaskCommandResult;

assignTaskCandidate(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, candidateId, observedAssistantCount,
}, env): TaskCommandResult;

cancelTask(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, observedAssistantCount,
}, env): TaskCommandResult;

progressTask(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, progressSummary, observedAssistantCount,
}, env): TaskCommandResult;

completeTask(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, resultSummary, observedAssistantCount,
}, env): TaskCommandResult;

failTask(domain, {
    actionId, taskId, expectedTaskRevision, expectedEventId, resultSummary, observedAssistantCount,
}, env): TaskCommandResult;
```

每个函数先完整校验输入、状态、CAS 和 action replay，再创建 eventId；失败不能消耗 ID 或改变输入。`TaskCommandResult.domain`是完整候选值，不允许调用者再补写 event。`changed:true`必有新 event；完全相同 actionId 重放返回既有 event/record 且`changed:false`；新 action 的语义无变化（当前仅 progress 摘要与既有值相同）返回`event:null, changed:false`且不消费 actionId；不同意图复用 actionId 报冲突。

### 2.3 ID 与时间

`application/ids.ts`创建`task-`、`task-event-`、`task-action-`、`task-board-`、`task-listing-`、`task-candidate-`前缀的 opaque ID。优先使用`crypto.randomUUID()`，不可用时使用当前毫秒 + 当前运行单调计数器；每个候选都必须再对当前 domain 与本次 batch 的 occupied set 查重，碰撞就继续生成。不能因为 Web Crypto 缺失而禁用 Tasks，也不计算聊天 hash。测试注入 factory，并覆盖 fallback 碰撞重试；生产代码不从 iframe、Agent、任务文本或展示名接收 ID。

factory 创建的 task/board/listing/candidate/event ID 最长 160，actionId 最长 200；`board:<taskId>`派生 world partyId 最长 180，账户最长 240，均由已校验 ID 确定性派生。`createdAt/generatedAt`只由 host 的`Date.now`注入。事件重放时读取已有值，不能重新生成时间。

### 2.4 Tasks/Economy 精确协议

每个有资金的 Task event 精确对应一条交易：

| event | from | to | kind | idempotencyKey |
| --- | --- | --- | --- | --- |
| accepted | `counterparty:task:board:<taskId>` | `escrow:task:<taskId>` | `task_funding` | `tasks:event:<eventId>:funding` |
| published | `player` | `escrow:task:<taskId>` | `task_funding` | `tasks:event:<eventId>:funding` |
| completed（世界 board） | escrow | `player` | `task_settlement` | `tasks:event:<eventId>:settlement` |
| completed（玩家发布） | escrow | `counterparty:task:<candidateId>` | `task_settlement` | `tasks:event:<eventId>:settlement` |
| failed/cancelled（世界 board） | escrow | 原 board counterparty | `task_refund` | `tasks:event:<eventId>:refund` |
| failed/cancelled（玩家发布） | escrow | `player` | `task_refund` | `tasks:event:<eventId>:refund` |

交易固定`actionId=event.actionId`、`sourceDomain="tasks"`、`sourceId=event.taskId`、`amount=冻结 reward`；title/note 由代码按本地模板生成。其余 Task event 必须零交易。

Tasks/Economy consistency check 既逐 event 重建预期交易，也通过 caller-bound Economy 视图扫描所有`sourceDomain="tasks"`、`kind`以`task_`开头、Tasks actionId、`escrow:task:`或`counterparty:task:`相关交易，拒绝缺腿、错腿、多腿和孤儿腿；不能只从 Tasks events 单向核对而漏过伪造交易。它同时核对每个 task escrow 的最终余额，但看不到其他业务分区或不属于 Tasks 的交易。

### 2.5 Application service 接口

`service.ts`只暴露面向 host 的用例，不暴露 store 或 ledger：

```ts
interface ReplaceBoardRequest {
    expectedBoardId: string | null;
    listings: readonly TaskListingDraft[];
    generatedAt: number;
}

interface ReplaceCandidatesRequest {
    actionId: string;
    taskId: string;
    expectedTaskRevision: number;
    expectedEventId: string;
    candidates: readonly TaskCandidateDraft[];
    observedAssistantCount: number;
}

readCurrent(): TasksServiceView;
acceptListing(input: AcceptListingRequest, guard: CommitGuard): Promise<TasksActionResult>;
publish(input: PublishRequest, guard: CommitGuard): Promise<TasksActionResult>;
replaceCandidates(input: ReplaceCandidatesRequest, guard: CommitGuard): Promise<TasksActionResult>;
assignCandidate(input: AssignCandidateRequest, guard: CommitGuard): Promise<TasksActionResult>;
cancel(input: CancelTaskRequest, guard: CommitGuard): Promise<TasksActionResult>;
replaceBoard(input: ReplaceBoardRequest, guard: CommitGuard): Promise<TasksActionResult>;
commitMaintenance(input: MaintenanceCommitRequest, guard: CommitGuard): Promise<TasksActionResult>;
```

每个业务写方法内部只调用一次 Tasks `ScopedChatStore.transact`，在同一 command callback 中读取 Tasks 分区、执行纯领域命令，并通过 Economy Transaction Capability 构造资金腿和运行交叉检查。`guard`在进入方法前和 sidecar replace 前各执行一次；service 不做保存后的补偿写，也不暴露完整 Envelope。文件级 write state、确认和采用服务端数据由 Kernel/Host 统一提供给 Shell，不进入 Tasks service，Tasks 不维护私有 write state。

施工时可对照下列小白酒馆实现核验可观察行为，但只能复制规则和 Prompt 经验，不能 import 运行时代码或沿用其 DB/楼层类型：

- board/candidate Prompt：`modules/tavern/app-src/features/phone-os/apps/tasks/tavern-task-prompts.ts`；
- 宽容响应与字段规则：`modules/tavern/shared/tasks/task-types.ts`；
- 三个高层工具：`modules/tavern/shared/tasks/task-tools.ts`；
- 活动任务 Agent 投影：`modules/tavern/app-src/runtime/task-context.ts`；
- 状态转移与托管语义：`modules/tavern/shared/tasks/task-service.ts`。

## 3. 步骤 A：纯 Tasks 领域

### 改动

1. 按终态第 6 节定义当前 V1 类型，不增加旧版本 union。
2. `invariants.ts`严格验证 exact keys、schemaVersion、domain revision、board 容量、board/listing/candidate/task/event/action 身份唯一、V1 枚举、字段长度、冻结 reward 和每任务连续 revision；accepted 的 board/listing 组合不得重复，assigned 的 partyId 必须来自前一候选快照。持久 validator 不执行当前方向排序、报酬区间、grade-range 或 3/2/1 posture 策略；这些只属于新 board 的生成/替换入口，partial board 仍合法。
3. `projection.ts`从事件得到 TaskRecord、当前 task revision/eventId、状态、候选人、累计进展和 Assistant 基线。
4. 三组 command 文件接收规范化高层命令，返回完整 next domain + created event + changed；accept/publish 把 reward 和合同字段冻结进事件，不读 store、不读 Economy、不生成账户。
5. 相同 actionId 的同意图返回既有结果，不同意图报`task_action_conflict`；CAS 失败不创建 ID、不改变输入。
6. assign 必须从当前候选快照复制完整资料并令`assignee.partyId === candidate.candidateId`；cancel 的 resultSummary 由领域命令生成，不能把 iframe 文本写进终态事件。

### 本步不做

- 不写 Agent Prompt、工具或 UI；
- 不保存 TaskRecord 缓存；
- 不增加 settings、descriptor 或 production 注册；
- 不复制 Tavern task types/service。

### 验证

- 用公开事件/命令输入验证全部合法和非法状态转移；
- 验证终态不可重开、同 board listing 不可重复接取、candidate 只作用于玩家发布任务；
- 验证累计 progress 替换、Assistant 计数下降只产生 0 差值；
- 验证超出当前生成区间但 canonical 合法的旧冻结 reward 可读取，而相同值作为新 board 输入仍被当前策略拒绝；
- 类型检查证明所有 union 分支闭合，不测试函数名或文件位置。

## 4. 步骤 B：Economy 原子协议与应用服务

### 改动

1. `economy-protocol.ts`只负责从 Task event 的冻结 reward 推导 funding/settlement/refund 资金意图，并核对 caller-bound Economy 结果；账户、金额、方向和 idempotency key 不接收 UI/Agent 输入，也不查询当前报酬区间。
2. `local-actions.ts`在一次 Tasks Scoped transaction 中读取 current Tasks，执行领域命令，并调用 Economy Capability 安装同一 sidecar candidate。
3. `maintenance-commit.ts`接收 Session 固定的 staged commands，在一个 Tasks mutation 中重做 task CAS，再生成全部 Task events 和相应 Economy 流水。
4. `service.ts`只暴露 read、accept、publish、replaceCandidates、assign、cancel、replaceBoard 和 commitMaintenance 的薄接口。
5. 所有本地动作在第一次非幂等写前和 sidecar replace 前再次检查：osId/binding 未变、app activation 有效、主生成空闲、Kernel 文件写状态 ready。

### 验证

- 世界接取/完成/失败/放弃和玩家发布/取消/完成/失败的资金路径；
- Task/Economy 任一候选不合法时整个 sidecar candidate 不上传；
- 明确保存失败一起恢复；unconfirmed 下重复点击不生成第二笔资金；
- funding/settlement/refund 与事件 actionId、sourceId、idempotency key 一一对应；
- Economy 中伪造或缺失 Tasks 资金腿会被 Tasks/Economy 交叉检查拒绝。

## 5. 步骤 C：显式 board/candidate generation

### 改动

1. `context-adapter.ts`只捕获终态第 7.1 节唯一`TaskGenerationContext`；请求层在同一时点把它与 board/task CAS 组装为判别式`TaskGenerationBoundary`。adapter 直接从`getContext()`复制允许的角色卡/persona/消息字段。世界书调用`getWorldInfoPrompt(..., hostMaxContext, true, globalScanData)`，同步宿主“扫描包含说话人名”设置，并传入已展开 persona/角色卡扫描资料；把`worldInfoBefore/worldInfoAfter`映射为文本，并从`worldInfoDepth[*].entries`展开文本。输出纯快照，不把 host 对象泄漏到 APP，也不把 task revision/eventId 发送给模型。
2. `generation/context.ts`统一做名字/正文规范化与容量裁剪；共享 XML formatter 负责动态资料的 XML/宿主宏转义。`safePromptJson`只用于 XML 内仍需保留 JSON 结构的领域投影：编码`< > &`，并只在 JSON 字符串内部编码花括号，保证宿主宏不展开且整体仍可无损解析。
3. Board/Candidate Prompt 按终态第 7.2 节分别实现，严格组装静态职责、system`<setting>`、system`<current_state>`、user`<task_data>`和 user 命令五层。不得写一个带 mode 分支的巨型字符串生成器，也不得 import Tavern 运行时代码。
4. `generation/json-response.ts`负责有界 JSON 提取和一次尾随逗号修复：单向扫描互不重叠的外层对象，不从残缺外层中抢救嵌套片段；仅修复字符串之外的结构逗号，保留正文及其转义。`response-compiler.ts`负责闭合 reason、每项白名单编译和 partial 结果，只返回无 ID board/candidate drafts；Candidates 先以规范字段比较现值，相同则返回既有 IDs/unchanged，不同才返回 drafts。
5. `generation/request.ts`在本地前置条件满足后才`loadConfig → openSession → run`。一次请求一个 session、一个 Provider 回合、`tools:[]`；不为无工具请求扩展 gateway。世界书和世界新闻是本次请求冻结的参考素材。保存前通过同一 adapter 以`includeWorldInfo:false`重捕获角色、玩家、近期剧情、总结与地图并深比较，不再扫描概率世界书，也不把新闻变化当作剧情变化；同时检查 activation token、主生成、expected boardId 或 task revision/eventId CAS 和 Kernel 文件写状态。全部通过后调用 application service，由 service 分配本批 ID 并执行唯一 Scoped transaction，generation 不 import ID factory 或 Store。共享素材适配器默认仍扫描世界书，其他 APP 行为不变。
6. board 和 candidate 的 AbortController 由任务模块持有；后台运行态只在当前运行内保存，同一时刻只接收一项显式生成，Host 接收即返回。离开页面、退出 APP、关闭 OS 窗口不取消，重开从 Host 恢复状态；切聊、主聊天开始生成、模块停用或 OS cleanup 取消尚未保存的请求。

### 验证

- 使用终态第 14.1–14.3 节公开 fixture 验证公开领域结果；
- JSON 外少量文本、尾随逗号、混合好坏、重复方向/名字、空候选、截断和超大数组；
- 32KB／256KB 未声明截断的异常响应、嵌套残片拒绝、字符串内逗号与转义保真；概率世界书只扫描一次且 board/candidate 的真实上下文和最终提交 CAS 保护保留；
- 当前 V1 执行者对象的字段顺序不影响读取；字段内容仍须逐项匹配已选候选事实，读取不改写存档；
- 全坏保留旧状态，部分成功只保存合法项并返回 partial；
- API 结果返回后切聊、board 被换新、task revision/eventId 变化均无写入；
- 不对 Prompt 单词或完整字符串做快照。只验证不可信数据没有进入 system rules、请求无工具且输出结果符合编译契约。

## 6. 步骤 D：活动任务 maintenance participant

### D1. 通用 runner 的最小改动

真实第二消费者只触发以下三项通用修改：

```ts
MaintenanceSession | null | Promise<MaintenanceSession | null>
```

1. `null`统一表示 participant 当前没有领域工作。job executor 为其记录`skipped/no-work`；所有 participant 都返回 null 时，在`gateway.loadConfig`之前结束。
2. `MaintenanceSession`使用终态 8.4 的通用`dataMessages`；runner 在 participant 确认有工作后捕获共享 system`<setting>/<current_state>`，再放各 participant 的 user data 与 user`<accepted_turn>`。不得把 TaskRecord、Map 字段或 Story Summary 类型硬编码进 common runner。
3. Provider loop 对已进入领域 Session 的`ok:false`只负责回喂和重复签名刹车，不按工具名保存第二份未解决状态；JSON 解析/未知工具/execute throw 仍作为调用级传输失败追踪。最终领域失败由`session.getResult()`判定。

Map participant 仍返回 Session，公开行为不变；玩家展示名只来自 runner 的`<accepted_turn>`。必须补 runner 集成测试证明：null participant 不捕获背景、不读取配置；共享背景只出现一次；触发 User 与未来 L2 不进入背景；Map 已有实体失败仍由 Map Session 保留；Tasks 跨工具修正不会留下按工具名产生的假 partial。不为内部分支写源码字符串测试。

### D2. Tasks 自有链路

1. participant 对 rebuild 返回 disabled；automatic 要求 autoMaintenance，manual 在 OS 运行期间固定可用。
2. createSession 读取当前投影，只选择`source.assistantCount > lastObservedAssistantCount`的 active 任务；无合格任务返回 null。Session 冻结入选任务各自的 revision/eventId 和 source.assistantCount，不用全局 domain revision 让无关 board 或其他任务变化误伤本次维护。
3. Prompt 只包含终态第 8.2 节静态规则；active 投影放 Session dataMessages，接受消息由 runner 统一放另一个 user message。
4. 三个工具严格使用终态第 8.3 节 schema/description，只调用 command compiler，不触碰 store/Economy；Session 以 taskId 跟踪每任务一个 changed command 和实体失败，以 participant call key 跟踪无 taskId 失败。
5. `getResult/canCommit/commit/invalidate`遵守现有 Map Session 协议；commit 只调用`maintenance-commit.ts`。
6. commit 在同一 Tasks Scoped transaction 中重新检查全部 staged task 的 revision/eventId；任一相关任务已变化就拒绝整次 Tasks commit，不产生半组任务/资金事件。sidecar replace 前通用 guard 失败丢 staging；replace 已发出后的结果交给 Kernel，如实返回，不自行补偿。

### 验证

- 无符合来源边界的 active 或 automatic job 下自动开关关闭时，均在配置读取前结束；新接取/新指派任务不得消费其 active 事件之前的接受轮；
- 同任务尚未成功 staging 时可换另一个 Task 工具修正失败；已有 changed command 后，相同命令幂等、不同命令拒绝且不能覆盖 staging；不同任务可同时 stage；其他 task 的成功不能误清实体失败；
- 混合合法/非法工具、修参、重复失败刹车、Provider 后续失败和 12 回合上限；
- task CAS、接受消息、osId/binding、自动 token 任一变化时保存前无写入；
- Map + Tasks 各有工作时只 open 一个 Agent session，各自 Prompt/工具/staging，提交结果互不冒充；
- Tasks partial commit 中 Task/Economy 仍保持领域内原子。

## 7. 步骤 E：主 RP Prompt 与 host Controller

### 改动

1. `prompt-runtime.ts`只消费已提交 Task 投影，按终态第 11 节生成 `<active_tasks>`自然语言块：仅最新 5 个 active/recruiting，包含标题、等级、标签、缘由与线索、目标、要求、地点、时机、风险、报酬和此前进展，不注入终态或内部身份字段；使用 Tasks 自己的 extension prompt key。
2. 生命周期与现有 Map prompt runtime 相同：generation start/intercept/request built/end/stop/chat change/OS cleanup 全部有明确清理。
3. Controller 激活时同步读取已有 Tasks/Economy；首次缺 Economy 时立即返回 loading 并后台复用开户流程。
4. Controller 只接收领域 ID、用户表单、CAS 和 iframe 请求相关 ID；领域 actionId 由 host 创建并在一次动作的保存/重试中固定。发布表单按终态 6.1 的独立上限校验，不能误套 board 的短文本限制。presentation 负责稳定文案，绝不把内部错误传进 iframe。
5. Host/frame 消息按 board、candidate、local mutation 和 maintenance 分组；每类在途状态彼此独立，不能用一个全局 busy 卡死只读页面。文件确认和采用服务端数据由 Kernel/Shell Bridge 单独处理。

Controller 向 iframe 返回的唯一完整状态为：

```ts
interface TasksPresentation {
    status: 'ready' | 'loading' | 'saving' | 'unconfirmed' | 'conflict' | 'blocked';
    message: string;
    writeState: 'loading' | 'ready' | 'saving' | 'unconfirmed' | 'conflict' | 'failed';
    settings: { autoMaintenance: boolean };
    playerBalance: number;
    generationActive: boolean;
    board: null | {
        boardId: string;
        listings: Array<TaskListing & { accepted: boolean }>;
        generatedAt: number;
    };
    active: TaskRecord[];
    recruiting: TaskRecord[];
    history: {
        items: TaskRecord[];           // 首次 20 条
        nextCursor: string | null;     // 由 updatedAt + taskId 组成的不透明游标
        hasMore: boolean;
    };
    maintenance: {
        state: 'idle' | 'running';
        message: string; // Host 根据完整结果和原因生成安全文案，不丢弃 skipped 原因
    };
}

interface TaskDetailPresentation {
    task: TaskRecord;
    timeline: Array<{
        eventId: string;
        kind: TaskEvent['kind'];
        taskRevision: number;
        createdAt: number;
        summary: string; // 由事件类型和已校验字段本地派生
    }>;
}
```

Host 路由固定为：`tasks/activate`、`tasks/read`、`tasks/detail/read`、`tasks/refresh`、`tasks/board/accept`、`tasks/publish`、`tasks/candidates/refresh`、`tasks/candidates/assign`、`tasks/cancel`、`tasks/maintenance/run`、`tasks/settings/update`、`tasks/history/load-more`、`tasks/save/confirm`、`tasks/save/adopt-server`。除 activate 外，所有请求携带激活返回的 app activation token；任务动作再携带`taskId + expectedTaskRevision + expectedEventId`，其中 expectedEventId 只作为不透明 CAS；board accept 携带`boardId + listingId`；settings/update 只接受`autoMaintenance`。文件确认/采用服务端数据由 Tasks 入口转交 Kernel，不另建保存流程。Controller 不接受余额、账户、新 eventId/actionId、issuer/assignee 对象或任务 status。

`status`由本地 presentation 唯一派生：首次 Economy 开户和文件读取为 loading；Kernel 文件状态映射 saving/unconfirmed/conflict。`failed` 时有待核实候选仍显示 unconfirmed 并保留核实入口，无候选才显示 blocked 和重试读取；初始化明确失败为 blocked。`message`只取稳定本地文案。`generationActive=true`时所有写动作和 Agent 请求禁用，只读仍可用。

失败反馈保留配置、Provider、安全校验与保存阶段的区别。Provider 的 HTTP 状态仅映射到受控分类（密钥／权限、请求不支持、限流／额度、超时、服务不可用），不把错误正文或密钥传给 UI。未开始检查不显示为“无需更新”。保存恢复沿用同一候选；只有实际 confirmed/adopted 才提示成功，恢复后只撤换对应保存失败提示，不清掉无关 API 失败。故障原因和运行状态仅驻留当前运行，不新增持久化字段，不新增自动重试。

activate 和每个状态写成功都返回新的完整`TasksPresentation`（历史重置为第一页），不让 iframe 自己乐观拼 TaskRecord；`history/load-more`只返回下一页，iframe 仅按 taskId 合并这类只读分页；`detail/read`按 taskId 返回`TaskDetailPresentation`，不暴露 actionId 或账户。失败响应只给稳定本地 code，presentation 映射用户文案。刷新/候选/maintenance 另带各自 outcome，不能把 Provider error 塞进 state。

### 验证

- 主 Prompt 字段白名单、XML/宏编码和全生命周期清理；
- Kernel 已加载当前 sidecar 且 Economy/Tasks 有效时打开同步 ready，不增加网络读取且零 Agent；
- 仅目标写动作被串行化，慢 board 请求不阻止查看历史；
- unconfirmed/conflict 下只读仍可用，所有写与 Agent 请求被本地阻止；
- 采用服务端数据只有在完整读回和 Envelope 校验成功后恢复 ready。

## 8. 步骤 F：UI

### 改动

1. `TasksApp.vue`只维护 route、host 消息相关性和页面组合；业务表单、候选人、列表、详情、设置拆到独立组件。一级导航为「发现 / 我接的 / 我发布 / 记录」，不再叠加接任务二级页签；返回位置和焦点只在当前 UI 运行内保存。
2. 大厅/候选/维护使用各自业务动作名；不加“使用 Agent”标签或 API 成本弹窗。维护按钮从 Host 状态显示“正在更新”并禁用重复点击。
3. 发布确认明确显示余额、托管金额和取消边界；active 详情提供放弃 / 取消入口，recruiting 仍可取消退款，终态无取消入口。确认框区分两条资金路径，说明取消后退出注入与维护、保留记录且不可撤销。
4. 详情优先展示当前累计进展 / 结果与完成目标；冻结原文、报酬、唯一 requirements、出资/执行方等置于可展开原委托区，取消入口保持独立可见，下方是本地事件时间线。
5. 设置页解释“仅有 active 任务且出现晚于其状态基线的新接受轮才调用；在下一条 User 保存后处理上一接受轮”；关闭开关不立即检查任务或 Agent。
6. 应用自有白底 / 中性深色配色，紫色用于操作和报酬；桌面图标同步。删除宣传大卡与做旧装饰，列表用细分隔线；原生表单、窄屏、长文本、空态、loading、partial 和保存冲突均需检查。

### 浏览器验收

- 空 board、六项 board、五项 partial、无人应征、长候选资料和全部终态；
- 320px、390px 与桌面宽度无横向溢出，底部导航随应用深浅主题切换；
- 慢 host 响应先显示页面骨架，不出现长时间空白；
- 打开、切页、关开关的网络面板无 Agent 请求；
- 保存已经发出后关闭页面，重开能看到真实最终状态，不显示伪取消。

完成通知由 Tasks 自有 background runtime 订阅 Scoped store 的已确认快照，production composition 接到宿主 toastr（与 `/echo` 相同显示入口，开启 `escapeHtml`）；不拼接 slash command。初次加载和切聊只记录完成事件基线，后续新 completed 才通知；OS 窗口开关不影响订阅。去重集只在当前聊天 / osId 的运行内保存，模块停止时取消订阅。通知异常不能改变结算成功结果。

取消与通知回归复用真实 service / store / Economy 集成测试：两条 active 取消、单次退款、CAS、迟到维护拒绝、失败/未确认不发布、确认后退款或通知、首次历史静默、重读去重、切聊天隔离和通知入口异常。

取消与通知阶段验证：OS 648 项测试、类型、lint、imports 与构建通过；正式 UI 在隔离宿主预览完成 320px / 390px / 桌面、深浅主题及键盘取消确认。浏览器预览不接真实模型或用户存档，真实酒馆聊天触发的完成通知仍待实测。

2026-09-06 UI 更新验证：正式构建组件在隔离浏览器检查 320px / 390px / 700px / 1200px、深浅主题、长标题与 150% 文字放大、空态 / 获取中 / 失败状态；覆盖四项主导航、详情返回位置 / 焦点、接取、放弃、发布、招募 / 选人、取消退款、记录分页、设置、保存核实 / 采用服务端 / 重试读取。成功提示不跟随用户进入无关页面。打开和阅读未产生模型生成请求。浏览器桥接及资金数据为内存模拟，不代替真实存储、模型或宿主通知验收；OS 714 项测试、类型、lint、imports、构建和 diff 检查通过。

## 9. 步骤 G：设置、注册和 Kernel 换轨

业务设置已经交付，底座施工时保留产品行为并替换注册边界：

1. Tasks 设置 normalizer 保持`apps.tasks:{autoMaintenance:false}`默认值；用户级 OS settings 不因新增 APP 提升 schema 版本，也不存在 Tasks enabled 字段。
2. `apps/tasks/module.ts`注册`tasks`分区 parser、Economy/Agent/Maintenance Capability 依赖、Host runtime、dispose 与 clearData。
3. Host catalog 注册 module；Shell catalog 只注册静态 descriptor 与`ui/entry.ts`动态 loader。两边 ID 必须一致，但不得静态互相 import runtime/UI。
4. Tasks participant 通过 Maintenance Capability 注册；通用 registry 不增加 Tasks 字段或状态分支。
5. 删除 production composition 中的 Tasks 手工 wiring、root validator、完整根依赖和 Shell 静态组件 import，不保留转发壳。
6. settings runtime 只在关闭自动维护时立即 invalidate 自动 job，不控制 APP 可见性；manifest/build entry/import graph 纳入新模块，运行产物不得引用 Tavern Tasks。

## 10. 测试取舍

| 稳定契约 | 最低成本证据 | 防止的真实故障 |
| --- | --- | --- |
| 状态机与事件不变量 | domain 单测 | 终态重开、跨任务 action/revision 污染 |
| response 宽容边界 | compiler 单测 + 公开 fixture | 一个坏 listing 拖死整板、空候选误判失败 |
| Task/Economy 原子性 | application 集成测试 | 有任务没钱、扣钱没任务、重复结算 |
| Session 高层工具 | participant 集成测试 | Agent 绕过状态机、同任务双事件、坏项拖死好项 |
| 无工作零 API | runner 集成测试 | 没有符合接受边界的 active 任务仍烧 API |
| Map/Tasks 单 session | runner + fake gateway | 每个 APP 各开一个 adapter/tool loop |
| Prompt 数据边界 | builder 公开输出结构测试 | 用户任务文本进入可信 system rule |
| 生命周期和迟到结果 | Controller/store 集成测试 | 切聊误写、保存后伪取消、Prompt 残留 |
| 真实交互/深色控件 | Playwright/人工浏览器 | 页面空白、掉色、窄屏不可操作 |
| 类型/产物 | TS、lint、build、manifest/import | 接口漂移或错误依赖进入 bundle |

不写以下测试：Prompt 单词/全文快照、源码 includes/正则“文件存在”、函数名/目录位置、与 domain 单测重复证明同一规则的 UI mock。Prompt 语义质量使用终态第 14.5 节真实 Provider 验收，不用脆弱字符串测试冒充。

## 11. 通盘 review 清单

施工完成后必须一次性过完，不得查出几个问题就收工：

- 上游：settings、SillyTavern context、MESSAGE_SENT、主生成、Agent Capability、Kernel 文件写状态；
- 下游：Tasks UI、主 RP Prompt、Wallet 流水、Map 同 job、保存确认/采用服务端；
- 数据流：响应文本→compiler→domain、工具→staging→Tasks Scoped transaction + Economy Capability、分区 snapshot→presentation；
- 并发：双击、慢请求、FIFO、同 task CAS、board/candidate 迟到、切聊、关开关、页面关闭；
- 错误：配置缺失、Provider 截断、JSON 部分坏、工具修参失败、save failed/unconfirmed/conflict；
- 删除：非终态 escrow 清理、`tasks`分区与两处 catalog/participant 注册清除、Economy 历史按产品策略处理、无兼容壳；
- 视觉：空态、partial、长文本、暗色原生控件、移动端、首屏无 host timeout 空白。

## 12. 完成定义

- 终态第 14、15 节全部有对应证据；
- Tasks 不引用 Tavern 代码或复制 Tavern DB/楼层语义；
- 没有低层领域 patch 工具、任意 JSON path、通用余额工具或 Tasks 专属 runner；
- 没有符合接受来源边界的 active task 时零配置读取、零 adapter、零 Provider 请求；
- 任务与资金的每条写路径原子，保存 commit point 文案真实；
- 全量 OS 测试、构建、lint、Tauri、manifest、import 检查和`git diff --check`通过；
- 真实 SillyTavern 浏览器与至少一个真实 Provider 验收完成；
- review 记录明确区分自动检查、浏览器检查和未验证项，不写失实的“完整收尾”。
