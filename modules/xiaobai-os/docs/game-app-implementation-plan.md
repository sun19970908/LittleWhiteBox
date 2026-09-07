# 赌场 APP 施工方案

## 1. 开工检查

| 项目 | 结论 |
| --- | --- |
| 功能所有者 | Game 领域 |
| 唯一事实来源 | Game 事件链；资金以 Economy 流水为准 |
| 持久态 | command/result、私有骰子/牌堆/步骤、终局活动 |
| 临时态 | UI 页面、动画、busy、分页、生成 guard |
| 外部依赖 | ScopedChatStore、Economy Transaction Capability、随机源、Shell |
| 注册入口 | Game Host/Shell catalog、module、`game`分区 parser、Capability 依赖 |
| 删除路径 | 处理 active escrow 后删目录/两处 catalog 注册并清理`game`分区 |
| 最少测试 | 三个状态机、随机、私有投影、原子资金、Controller |

## 2. 施工顺序

### A. 三个纯状态机

1. 每个游戏只接收 state/action/random，返回下一状态或终局结果。
2. 金额、倍率和概率使用安全整数。
3. 非法动作、非法下注、非法选择在读取随机前失败。
4. Public view 深拷贝，绝不暴露庄家骰子和完整牌堆。

### B. Game 事件层

1. 定义一个 active game 与终局 activity 的线性事件。
2. append 校验 CAS；actionId 重放先比较明确意图。
3. 事件成功后重放得到唯一当前状态。
4. 持久解析与历史重放独立于`games/`当前策略：只校验 V1 生命周期、已保存私有事实、结果类别、金额安全和状态连续性。
5. 骰子历史不重选庄家叫价或重算赔率；Push 历史从`game-started`读取下注；Ladder 历史不调用当前倍率、层数或封顶参数。
6. active game 的下一次命令仍交给当前状态机严格校验；新策略不得反向改变已经保存的 event/activity。

### C. Economy 组合

1. 开局按当前命令策略创建下注 escrow 资金腿，并把实际下注冻结在`game-started`结果中。
2. 中间动作不记账。
3. 终局创建 reserve/payout/loss 资金腿，过滤 0 金额。
4. 在 Game Scoped transaction 中调用 Economy Capability，把 Game 与 Economy 分区安装到同一 sidecar candidate；业务层不得取得完整 Envelope。
5. 交叉校验从保存事件中的 amountIn/payout 推导资金腿顺序和 active escrow，禁止从当前常量重建历史资金。

### D. Controller 与 UI

1. 当前 sidecar 已加载且已有 Economy 时同步打开，缺失时通过协调器执行明确开户事务。
2. Controller 绑定 app activation token 与当前 osId/binding、串行化动作、过滤客户端伪造字段。
3. 大厅、目录驱动的玩法房间、入场与结算、各玩法记录详情分别成组件。大厅直接两列/三列展示游戏，不设置宣传开场；搜索、分类、返回滚动属于当前聊天运行内状态。
4. 文件级未确认上传冻结当前聊天全部 sidecar 写动作并提供确认。
5. 桌面和移动端都必须能完成完整一局。
6. 本地插图、白骰、紫色牌桌和蓝色阶梯只负责表现，不决定结果。胜负样式从真实揭示结果读取；减少动效、保存核实、再次下注前的显式确认语义保持不变。

## 3. 回归重点

- action 重放不会重抽骰子/牌堆或重复扣款；
- 历史庄家叫价、胜局倍率、Push 下注/牌堆参数和 Ladder 步骤即使不符合当前策略，只要记录与账本自洽仍可读取；
- 新开局和 active game 的下一动作仍使用当前赔率、下注与阶梯规则；
- 明确失败和未确认保存不会产生半个赌局；
- 聊天正文与 Assistant 数量变化后 Game 根完全不变；
- 切聊或页面重开使迟到结果失效；
- 私有随机材料不进入 iframe；
- 已有 Economy 时激活无后台准备。

Game 不需要剧情状态、Assistant 回合、anchor 或 reconciler；这些字段和注册不得出现。
