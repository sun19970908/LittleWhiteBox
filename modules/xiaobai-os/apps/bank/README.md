# Bank app

`apps/bank`负责把纯 Bank 领域接入 ScopedChatStore、Economy Transaction Capability、iframe 协议和 Vue UI。

- `application/economy-protocol.ts`：由 Bank event 生成资金意图，并核对 caller-bound Economy 结果。
- `application/commands.ts`：存入、提前支取、开立理财和到期结算命令。
- `application/service.ts`：CAS、actionId 幂等、Assistant 回合读取和跨分区单次 sidecar 提交。
- `host/controller.ts`：app activation、首次开户、操作状态和 frame 消息。
- `host/presentation.ts`：隐藏锁定理财收益，生成客户端 DTO。
- `ui/`：金库、产品、头寸、记录和操作弹窗。

Bank 只向宿主读取一个窄事实：当前聊天已完成的 Assistant 回复数量。它不读取消息文本，不做剧情核对。当前 sidecar 已加载且已有 Economy 时 APP 立即打开；只有首次开户经过 Kernel 协调器异步提交。
