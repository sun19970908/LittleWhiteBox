# Shop app

`apps/shop`负责 Shop/Economy 原子购买、道具操作、效果交付、客户端 DTO、主 RP Prompt 注入和 Vue UI。

- `application/service.ts`：购买、激活、关闭和单次交付的 Scoped transaction。
- `application/economy-protocol.ts`：购买资金意图与 caller-bound Economy 核账。
- `application/effect-delivery-queue.ts`：按聊天隔离的临时交付队列、在途投影与后台顺序落账。
- `partition.ts`、`module.ts`：严格 Shop 分区及`economy.read`/`economy.transaction`能力声明。
- `host/controller.ts`：app activation、首次开户、操作状态和 iframe 协议。
- `host/presentation.ts`：目录、库存和按`appliedCount`计算的效果状态。
- `host/message-receipts.ts`：准确消息/当前 swipe 的收据读取与同步绑定。
- `host/prompt-runtime.ts`：生成事件、normal/regenerate/swipe/continue 判定及 Prompt 生命周期。
- `ui/`：货架、库存和动作弹窗。

`legacy-service.ts`、`legacy-root-protocol.ts`和`legacy-controller.ts`仅保留生产切换前的 metadata-root 路径；新服务不读取完整 OS root 或 Economy ledger。

购买和扣款在同一次 sidecar commit 中保存。normal 回复一形成，消息收据与在途交付就在当前调用内生效；下一轮读取“持久 Shop + 在途交付”，不等待 sidecar 上传，后台只按序把 deliver 落入`shop`分区。Shop 不读取楼层或剧情内容，不因编辑、删除、swipe 或分支而回滚经济事实。当前 sidecar 已加载且已有 Economy 时 APP 同步打开，首次开户才经过协调器异步准备。
