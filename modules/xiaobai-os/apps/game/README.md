# Game app

`apps/game`把纯 Game 状态机接入 PartitionStore、Economy Transaction Capability、iframe 协议和 Vue UI。账户归属、存储及事务边界见 [Economy 平台终态设计](../../docs/economy-platform-target-design.md)。

Application service 在一个 Scoped transaction 中把游戏事件与下注/派彩资金腿放入同一个用户文件 candidate，并保留业务版本校验、actionId 幂等和随机只抽一次。保存期间 UI 立即播放不含结果的中性动画；只有 commit 确认后才把真实骰面、结算记录和新余额交给牌桌。明确失败在当前 Host 运行内保留同一 candidate 并冻结后继写入，用户的“重试保存”不重新执行游戏命令。Controller 绑定 app activation token 与 osId/binding，只转发明确的用户意图；Presentation 逐字段复制公开状态，私有骰子和牌堆不会进入 iframe。

Game 不读取普通聊天消息或 Assistant 回合，也不注册聊天变化后台服务。
