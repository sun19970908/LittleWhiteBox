# Bank app

`apps/bank`负责把纯 Bank 领域接入 PartitionStore、Economy Transaction Capability、iframe 协议和 Vue UI。账户归属、存储及事务边界见 [Economy 平台终态设计](../../docs/economy-platform-target-design.md)。

- `application/economy-protocol.ts`：由 Bank event 生成资金意图，并核对 caller-bound Economy 结果。
- `application/commands.ts`：存入、提前支取、开立理财和到期结算命令。
- `application/service.ts`：业务版本校验、actionId 幂等、Assistant 回合读取和跨分区单次用户文件提交。
- `host/controller.ts`：app activation、存储准备、操作状态和 frame 消息。
- `host/presentation.ts`：隐藏锁定理财收益，生成客户端 DTO。
- `ui/`：金库、产品、头寸、记录和操作弹窗。

Bank 只向宿主读取一个窄事实：当前聊天已完成的 Assistant 回复数量。它不读取消息文本，不做剧情核对。
