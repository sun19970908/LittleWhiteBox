# 商店 APP 施工方案

## 1. 开工检查

| 项目 | 结论 |
| --- | --- |
| 功能所有者 | Shop 领域 |
| 唯一事实来源 | Shop V2 事件链 + 不可变发布合同；余额仍以 Economy 流水为准 |
| 持久态 | purchase/activate/deactivate/deliver 事件、规范化参数、Assistant 消息效果收据 |
| 临时态 | 当前生成 pending、regenerate 暂存收据、按聊天在途交付队列、extension prompt、页面筛选/弹窗/busy |
| 外部依赖 | ScopedChatStore、Economy Transaction Capability、SillyTavern generation 事件、generate interceptor、extension prompt、消息 extra |
| 注册入口 | Shop Host/Shell catalog、module、`shop`分区 parser、Capability 依赖、Prompt runtime |
| 删除路径 | 删 APP/domain/两处 catalog 注册，清`shop`分区与消息收据 |
| 真实兼容对象 | 当前 SillyTavern 事件顺序、流式/非流式消息结构、浏览器 structured clone |
| 最少必要测试 | 领域投递、跨分区单次 sidecar 提交、Prompt 公开输出、generation 时序、跨聊天/失败路径 |

测试线旧 Shop 楼层 schema 不兼容；运行时只认 V2，不保留 V1 读取或双写分支。

## 2. 终态施工顺序

### A. 纯 Shop 领域

1. 把首批 25 件商品登记为不可变发布合同，另以 ID 列表定义当前货架。
2. 发布合同 ID 一旦使用，其价格、`replies/manual/permanent`期限、输入、叠加和可信规则不可原地修改；改版必须使用新 ID，旧合同只允许下架。
3. 定义只含事件数组的`ShopDomainV2`。
4. 实现 purchase、activate、deactivate、deliver 与 actionId/CAS；只有 purchase 查询当前货架，其余历史与投影路径查询发布合同库。
5. 重放事件得到库存、购买次数、activation 和`appliedCount`。
6. 生成下一条新回复的效果收据；只有 deliver 才消耗有限次数或确认结束规则。
7. 规范化并编码用户参数，不把用户文本拼进可信规则，也不持久化可信规则副本。

### B. Economy 原子购买

1. purchase 校验当前货架、购买上限、CAS 与余额；下架合同拒绝新购。
2. 在 Shop Scoped transaction 中调用 Economy Capability，同时生成 Shop purchase event 与 Economy 扣款交易，并形成一个 sidecar candidate。
3. 历史核账按发布合同验证 actionId、冻结价格、方向、来源和一一对应关系，不受货架变化影响。
4. activate/deactivate/deliver 不制造资金流水。

### C. 回复收据与 Prompt runtime

1. normal 在 generate interceptor 取当前 Shop 收据并安装 Prompt，不提前消耗。
2. normal 读取“持久 Shop domain + 当前聊天全部在途交付”的顺序投影，不等待网络保存。
3. `MESSAGE_RECEIVED`后同步校验当前聊天与非空 Assistant 消息，把收据绑定到准确消息/当前 swipe，并同步加入在途交付队列后立即归还宿主事件。
4. 在途队列以稳定 actionId 单路落账；成功删除队首，失败保留队首和后继并暂停，下一条新回复、读回确认或重进聊天时用原 actionId 续交。
5. 单条消息 regenerate 在`GENERATION_STARTED`捕获旧消息收据，因为 SillyTavern 随后会先删除旧消息；新回复只回挂收据。
6. swipe/continue 直接复用消息或 swipe extra 中的收据，不提交 Shop 写入。
7. dry-run、显式停止、空回复、切聊和 runtime 停止取消生成 pending；已经形成的在途交付不取消。
8. `GENERATE_AFTER_DATA`与`GENERATION_ENDED`只负责及时清 Prompt；后者不能冒充成功/失败判据。

这里不读取聊天文本来推导剧情，只在提交点确认目标确实是非空 Assistant 消息。

### D. Controller 与 UI

1. 已有 Economy 同步打开；只有首次缺失 Economy 时异步开户。
2. Controller 绑定 app activation token 与当前 osId/binding、串行写入，只接收商品 ID、参数、CAS 与 actionId；订阅 Scoped Store 与 Kernel 文件状态以接收后台回复提交的新 revision 和保存结果。
3. Presentation 直接展示`appliedCount`推导的“剩余 N 条新回复”，不读取当前楼层。
4. 货架、库存、效果、详情和动作弹窗保持组件边界；应用与底部导航使用商店自有深浅配色，外壳仍归 OS。首页直接陈列商品，取消宣传封面；本地物件插画与桌面图标保持清亮。详情返回恢复搜索、分类、滚动与商品焦点，不持久化 UI 状态。
5. 文件级未确认上传只显示保存状态和确认入口，不出现“剧情核对”文案。

### 2026-09-06 UI 更新验收

正式构建组件在隔离浏览器中检查 320px / 390px / 700px / 1200px、深浅主题、长商品名与 150% 文字放大；覆盖搜索分类、详情返回位置 / 焦点、购买确认与防重复、库存参数输入、手动关闭、永久效果、限购、余额不足、失败重试及未确认保存核实。成功提示只在结果页保留，用户继续导航后清除；失败与待核实提示不受此规则影响。

预览使用真实 Shop 领域和投影，资金与宿主桥接为隔离内存模拟，未接真实聊天、用户存档或模型服务；不将此记录作为真实宿主保存验收。OS 714 项测试、类型、lint、imports、构建和 diff 检查通过，构建分块引用齐全。

## 3. 必须通过的回归

- 购买只扣一次；明确失败时余额与库存一起恢复。
- 下架合同不可新购，但既有 purchase、库存、activation、Prompt 和 Economy 核账保持有效。
- 使用只消耗一件库存，不再扣款。
- 一条 normal 回复最多增加一次`appliedCount`。
- 前一个 sidecar 上传很慢时，连续 normal 回复也不能读回同一份有限效果。
- 交付队首失败时，后继不越过它落账，但所有已形成回复仍计入当前运行的有效投影。
- 单条消息 regenerate 即使在拦截前旧消息已被宿主删除，也能复用旧收据且不增加次数。
- 群聊整批 regenerate 没有宿主提供的一一对应关系，按删除旧批次后重新生成 normal 回复处理，不返还旧次数也不伪造映射。
- swipe/continue 使用原收据且不触发额外 Shop 保存。
- 停止、dry-run、空 Assistant 消息不消耗。
- 删除/编辑消息不退款、不返还道具、不恢复已用次数。
- 参数不能逃逸 XML 数据区或触发 SillyTavern 宏。
- 切聊和保存失败不会把事件或收据写到另一聊天。

不创建剧情 adapter、hash、anchor、全局写门、story action runner 或 reconciler。未来任务系统必须在自己的领域内设计自动状态机。
