# Economy 平台终态设计

## 1. 目标

Economy 为普通小白 OS 提供一套小而可靠的资金事实：开户、余额、流水、幂等、多资金腿 action、显式冲正和跨领域原子提交。

它不是剧情系统，不判断消息因果，不拥有任务进度，也不随编辑、swipe、删除或分支自动倒账。

## 2. 开工检查结论

| 项目 | 结论 |
| --- | --- |
| 功能所有者 | `domains/economy`拥有资金规则；`capabilities/economy`拥有 Economy 分区与受限读写能力 |
| 唯一事实来源 | `EconomyLedgerV2.transactions` |
| 持久态 | 不可变交易 |
| 临时态 | Kernel 文件写队列、未确认候选、余额和分页投影 |
| 外部依赖 | Kernel Scoped transaction、时间与 ID 生成器 |
| 注册入口 | Capability catalog 中的 Economy Capability 与`economy`分区注册 |
| 删除路径 | 先处理资金消费者，再删除 Capability/domain 注册并清理`economy`分区 |
| 兼容对象 | 当前正式线没有 Economy 数据；测试线旧 metadata 根不迁移 |
| 最少测试 | 账本不变量、幂等/冲正、sidecar 保存失败、跨分区原子资金 |

## 3. 持久格式

```ts
interface EconomyLedgerV2 {
    schemaVersion: 2;
    transactions: EconomyTransaction[];
}

interface EconomyTransaction {
    id: string;
    sequence: number;
    idempotencyKey: string;
    actionId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    kind: string;
    title: string;
    note: string;
    sourceDomain: string;
    sourceId: string;
    createdAt: number;
    reversalOfTransactionId?: string;
}
```

不持久化 balance、快照、锁、当前页、剧情楼层、消息 hash 或分支指针。

## 4. 账本不变量

1. `sequence`从 1 连续递增，交易 ID 唯一。
2. 金额为正安全整数；转出与转入账户不同。
3. 玩家账户不得透支。
4. 同一 action 的多条资金腿连续出现，不能被其他 action 穿插。
5. 同一 idempotencyKey 重放必须与原意图完全相同；不同意图报冲突。
6. 开户 action 固定为`economy:opening-grant:v1`且只能出现一次，赠送 100 小白币；action、source 与金额共同构成不可修改的创世事实。
7. reversal 是一笔方向相反的新交易；被冲正交易、来源和金额可验证，开户赠礼不可冲正。

余额只是对所有资金腿的投影。

100 小白币不是“当前开户活动”或可调整常量。直接修改它会使所有既有账本在加载时失效；若未来需要改变新账户的创世规则，必须先定义明确的新账本版本/升级边界，不能让当前 validator 用新金额重判历史。

旧测试线 Economy V1 不属于兼容对象。生产切换后只解析 sidecar 中当前`economy`分区格式，不保留 anchor、旧根读取器或日常清洗器。

## 5. 跨领域原子提交

Bank、Game、Shop、Tasks 不是先写业务再调用钱包。各 application service 在自己的 Scoped transaction 中调用 Economy Transaction Capability：

```text
Kernel 强读当前 sidecar
→ 只解析业务分区与 Economy 分区
→ 校验业务 CAS/actionId
→ 生成领域事件
→ Economy Capability 生成资金腿
→ 安装到同一个 sidecar candidate
→ 校验业务 + Economy + 交叉不变量
→ 以一个 commitId 上传一次
```

任何校验或明确保存失败都不发布业务与 Economy 新快照，不允许出现“扣了钱但没商品”“赌局结束但没派彩”。保存结果不确定时，Kernel 保留同一个已序列化 candidate 并冻结当前聊天全部新写入；重试不得重新执行 command、抽随机或生成 ID。

## 6. 聊天与分支

Economy 位于当前聊天 sidecar 的`economy`分区。Kernel 用稳定 osId 绑定聊天，切聊后排队或迟到动作必须在上传前因 activation/binding guard 失败。

Economy 不读取消息正文。编辑、swipe、删除不会自动产生 reversal，也不会删除流水。创建分支时由 Kernel 复制父 sidecar 的已确认 partitions 并生成新 osId；之后两个 sidecar 分别写入。

如果未来某业务需要“随剧情撤销”，应由该业务状态机定义明确的补偿动作，再以普通 Economy action 记账；不能让 Economy 猜测剧情含义或裁流水历史。

## 7. Capability 与保存状态

Economy Capability 对消费者只暴露两类窄接口：

- Wallet 使用只读口读取玩家余额与分页流水；
- Game、Bank、Shop、Tasks 使用 caller-bound 事务口读取余额、提交资金 action，并且只能读取自己来源的核账流水；
- 消费者不能取得可写 Ledger、任意账户转账口或伪造`sourceDomain`；
- 文件级`ready/saving/unconfirmed/conflict`由 Kernel 提供，不由 Economy 复制。

Kernel 负责 osId/binding、单页写队列、强读、candidate、上传、commitId 读回确认与冲突状态。Economy 的订阅和投影均为临时态，不进入分区。

## 8. UI 边界

Wallet 是只读投影，不拥有调账入口。Kernel 已加载当前 sidecar 时，打开 Wallet 不另存聊天或扫描消息；首次开户走一次明确的 Economy transaction 并显示`loading`。`unconfirmed`表示上一次 sidecar 上传结果未知，不表示正在核对剧情。

## 9. 验收

- 同一聊天只开户一次；
- `opening-grant:v1`的身份与 100 小白币金额保持冻结，产品调整不重判既有账本；
- 幂等重试不重复保存或扣款；
- 多资金腿一次提交，失败无半条 action；
- Bank/Game/Shop/Tasks 的业务事件与资金交叉不变量能拒绝伪造分区组合；
- 聊天文本变化不改变账本；
- APP 不能越权读取或写入 Economy 分区；
- typecheck、测试、lint、build 全部通过。
