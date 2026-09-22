# Wallet app

钱包是 Economy 的只读用户界面，展示小白币余额、流水分页和保存状态。账户归属与存储边界见 [Economy 平台终态设计](../../docs/economy-platform-target-design.md)。它不拥有余额写入、调账、剧情、任务、商店、银行、游戏或宠物规则。

Economy 已准备好时，激活同步返回状态；否则 Controller 通过 Economy Capability 准备用户文件并显示`loading`。`unconfirmed`和`conflict`来自 Kernel 用户文件保存状态，不是账本核对。页面激活与聊天身份无关。

删除钱包只需删除 APP 目录及 Host/Shell catalog 注册；Wallet 没有自有分区，Economy 可继续服务其他 APP。

UI 使用钱夹式余额展示、按日期排列的收支账单和只读详情；收入、支出、系统划转筛选只作用于已加载账目，不伪造全量收支统计。`wallet/confirm-save` 由 Controller 调用安装上下文的 Kernel `retryPending`，只恢复已有文件提交，不授予钱包调账能力。
