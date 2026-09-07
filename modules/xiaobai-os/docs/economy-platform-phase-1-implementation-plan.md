# Economy 平台第一阶段施工方案

> **已封存，不得继续照此施工。** 本文只记录旧 metadata 根阶段已经完成过的实现，不再定义现行存储、事务或 APP 接入方式。`root store`、完整根 mutation、metadata 保存与 Economy repository 指令均已失效。当前施工必须使用 [OS Kernel 施工方案](./os-kernel-implementation-plan.md) 与 [Economy 平台终态设计](./economy-platform-target-design.md)：Economy 由 Capability 拥有`economy`分区，资金消费者在 Scoped transaction 中完成一次 sidecar 提交。待 Kernel 切换完成，本历史文档可删除。

## 1. 阶段目标

第一阶段交付根级数据写入边界、Economy 账本与只读钱包，并为 Bank、Game、Shop 提供正确的原子资金接入点。

本阶段明确不交付：剧情指纹、剧情核对、按消息回滚、任务状态机、第二份余额或 Tavern 数据桥。

## 2. 正确边界

```text
host/chat-data-store.ts
   └─ 当前聊天根的唯一写队列、保存与确认

domains/economy/
   ├─ types.ts
   ├─ invariants.ts
   ├─ ledger.ts
   └─ repository.ts

apps/wallet/
   ├─ host/controller.ts
   ├─ types.ts
   └─ ui/
```

Economy repository 消费根 store，不反向拥有宿主事件。Wallet 只消费 Economy repository。

## 3. 施工步骤

### A. 根数据 store

1. 以当前 chat identity 捕获 metadata 引用。
2. 所有 mutation 进入同一写队列。
3. mutator 接收完整旧根并返回完整候选根与业务结果。
4. 保存前后检查 identity 和 metadata 引用。
5. 明确失败恢复旧根。
6. 保存结果未知时保留候选，状态设为`unconfirmed`，禁止后续写入。
7. `confirmPending`读服务端结果：候选一致则确认，旧根一致则恢复，第三种结果进入 conflict。

### B. Economy 纯规则

1. 定义只含交易数组的 schema v1。
2. 开户写固定`economy:opening-grant:v1` action 与 100 小白币赠礼；两者是 V1 创世合同，不抽成可调产品配置，也不得原地修改。
3. 实现单腿与多腿记账、余额投影、流水分页。
4. 校验金额、账户、sequence、action 连续性和玩家不可透支。
5. 幂等判断先于 CAS 之外的副作用；重放不生成新 ID、不保存。
6. 冲正追加反向交易，不编辑旧交易。

### C. Repository

1. 每个公开写入口调用`store.mutateCurrent`。
2. 依赖注入时间和 ID 生成器。
3. 返回公开账本投影，不暴露可变根引用。
4. 把根 store 的`writeState`与`confirmPending`透传给消费者，并用临时订阅发布候选安装和终态变化。

### D. Wallet

1. 激活时先查`economy.hasCurrent()`。
2. 已有账本：同步构造第一页并返回`ready`，不启动后台任务。
3. 无账本：返回`loading`，后台执行一次`ensureCurrent()`，成功后推送状态。
4. 流水按 sequence 倒序分页；钱包不提供任意记账按钮。
5. 保存未确认时显示保存状态与确认动作，不出现剧情核对文案。

### E. 业务 APP 接入

Bank、Game、Shop 的 application service 直接使用同一个根 store，在一次 mutation 中安装自身事件与 Economy 流水，并注册各自的交叉不变量。不得建立“先调用 Economy repository、再保存业务领域”的双写流程。

## 4. 状态模型

持久态只有 OS 根与交易。`loading`、`saving`、`unconfirmed`、`conflict`是 Controller/store 的运行状态；除候选根本身外不另建持久锁或恢复快照。

APP 激活状态：

```text
已有 Economy ───────────────→ ready
无 Economy → loading → 保存成功 → ready
                    └→ 明确失败 → blocked
                    └→ 结果未知 → unconfirmed
```

不存在`reconciling`状态。

## 5. 最少必要测试

| 层 | 契约 | 防止的真实故障 |
| --- | --- | --- |
| 纯逻辑 | 开户、余额、不透支、幂等、多腿、冲正 | 重复发钱、负余额、半个 action |
| 根集成 | identity、单写队列、失败恢复、未确认读回 | 切聊误写、未知保存覆盖服务端 |
| 业务集成 | 领域事件与资金一次保存 | 扣款与业务状态分裂 |
| Controller | 已有数据立即打开、首次开户异步、分页 | APP 长时间空白、重复开户 |
| 构建 | TS、lint、bundle | 类型或产物漂移 |

不写读取源码字符串的“代码存在性测试”。聊天编辑不改变经济事实用 repository 的可观察根与余额验证，不模拟已经不存在的全局剧情 runtime。

## 6. 完成定义

- 当前聊天开户一次且只产生一笔赠礼；
- V1 开户 action/source/100 小白币由 validator 固定，后续产品改动不改变既有账本含义；
- Wallet 已有数据时同步可用；
- 不调用`/api/chats/get`来打开经济 APP；
- 无 Web Crypto 依赖；
- 无 story adapter、fingerprint、write gate、action runner 或 reconciliation runtime；
- Bank/Game/Shop 原子资金行为通过；
- 全量测试、lint、build 与 diff check 通过。
