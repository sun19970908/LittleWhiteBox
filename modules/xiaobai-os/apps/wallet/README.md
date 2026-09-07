# Wallet app

钱包是 Economy 的只读用户界面，只展示当前聊天的小白币余额、流水分页和保存状态。它不拥有余额写入、调账、剧情、任务、商店、银行、游戏或宠物规则。

当前 sidecar 已加载且已有 Economy 时，激活同步返回`ready`；没有 Economy 时，Controller 通过 Economy Capability 执行一次明确开户事务并显示`loading`。`unconfirmed`和`conflict`来自 Kernel 文件级保存状态，不是账本核对。

删除钱包只需删除 APP 目录及 Host/Shell catalog 注册；Wallet 没有自有分区，Economy 可继续服务其他 APP。

UI 使用钱夹式余额展示、按日期排列的收支账单和只读详情；收入、支出、系统划转筛选只作用于已加载账目，不伪造全量收支统计。`wallet/confirm-save` 由 Controller 调用安装上下文的 Kernel `retryPending`，只恢复已有文件提交，不授予钱包调账能力。
