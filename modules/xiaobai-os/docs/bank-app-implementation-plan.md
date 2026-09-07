# 银行 APP 施工方案

## 1. 开工检查

| 项目 | 结论 |
| --- | --- |
| 功能所有者 | Bank 领域 |
| 唯一事实来源 | Bank 事件链 + 不可变发布合同；资金仍以 Economy 流水为准 |
| 持久态 | command/result、冻结合同、Assistant 回合、金融活动 |
| 临时态 | 当前头寸投影、剩余期限、可领取状态、分页、操作弹窗 |
| 外部依赖 | ScopedChatStore、Economy Transaction Capability、Assistant 回复计数、主生成 guard |
| 注册入口 | Bank Host/Shell catalog、module、`bank`分区 parser、Capability 依赖 |
| 删除路径 | 处理 escrow 后删目录/两处 catalog 注册并清理`bank`分区 |
| 最少测试 | 数学、事件、回合投影、原子资金、随机幂等、Controller |

## 2. 施工顺序

### A. 纯领域

1. 将六款产品登记为不可变发布合同，另以 ID 列表定义当前货架；金额与百分比全部使用整数。
2. 同一合同 ID 不得原地修改，改版发布新 ID；历史读取与结算查询合同库，新开立查询当前货架。
3. 建立 Bank event、position、activity 与 CAS 类型。
4. 实现开立、提前支取、到期结算和线性重放。
5. 浮动收益只在新开立理财且所有校验通过后抽取。
6. Public view 在锁定期移除 resolvedReturnBps 与 settlementAmount。
7. 校验 revision、ID、发布合同可重算、活动净额和事件状态转换；产品下架不能使历史头寸失效。

### B. Application

1. 领域资金协议从 Bank event 确定唯一资金意图与预期资金腿；不得接收完整 Envelope 或任意 Economy Ledger。
2. Service 在 Bank Scoped transaction 中读取 current Assistant count。
3. 幂等 action 重放先于 CAS，不重抽随机、不重新保存。
4. 新动作通过 CAS 后生成 Bank 事件，并调用 caller-bound Economy Capability 生成资金腿，安装到同一 sidecar candidate。
5. 运行 Bank、Economy 与 Bank-Economy 交叉不变量。
6. 主生成开始前和提交前均检查 guard。

### C. Controller 与 UI

1. 当前 sidecar 已加载且已有 Economy 时同步打开；缺失时显示`loading`并通过协调器执行明确开户事务。
2. 每个 frame 请求绑定 app activation token 与当前 osId/binding。
3. Controller 串行化写动作，只转发产品、金额、positionId、CAS 与 actionId。
4. 产品、头寸和记录使用独立组件，不把业务堆进一个 Vue 文件。
5. 文件级未确认状态提供确认入口，并禁止当前聊天继续任何 sidecar 写动作。
6. 总览以本金、到期领取和产品入口为主，计期说明按需展开；产品、持有、记录采用平整分隔列表，原生确认框承担必要输入和风险确认。
7. 页面、样式和黑白银行图标仍由 `apps/bank/ui` 拥有；不改金融协议、产品合同、存储或注册，不保留旧皮肤。

## 3. 回归重点

- 当前 Assistant 数量下降后，未结头寸剩余期限变化，但 Bank 与 Economy 分区不变。
- 已结算头寸永不因消息变化恢复。
- 早退同时结算其他到期头寸时，所有 escrow 与活动一次提交。
- 保存失败不留下半个头寸；确认未知结果不重复抽收益。
- 已有 Economy 的激活不发后台读取。
- 下架合同不可新开，但既有头寸仍按发布合同正常投影、提前支取或到期结算。

不创建剧情 adapter、hash、anchor、write gate 或 reconciler，也不为测试线旧实现保留字段。
