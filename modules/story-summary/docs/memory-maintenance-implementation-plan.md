# 记忆 Agent 维护：施工文档

## 当前状态

2026-09-26：新总结排队启动下一 run；memory_updated 明确指引本轮跳过相关记录，不重读重试；本轮工程验收见[验证记录第 18 节](./memory-maintenance-verification.md#18-更新记录本轮跳过)。维护仍只在总结确认提交后启动自主 Agent run，没有手动执行入口。
真实模型质量与耗时验收尚未完成，不用工具测试代替语义结果。

[目标设计](./memory-maintenance-target-design.md)是产品语义、权限、持久态归属及验收口径的唯一来源。
本轮不改总结生成、锚点提取、检索、共享 Agent 配置或无关模块；不提交推送。

## 边界与落点

| 职责 | 所有者和落点 |
| --- | --- |
| 连续运行 | maintenance/runner.js：一段不断接收工具结果的对话，auto 工具选择、正常回复结束、整轮安全上限 |
| 会话与材料 | maintenance/session.js、opening.js：范围任务、当前记忆、原文审阅范围与稳定分页 |
| 范围进度 | maintenance/ranges.js：归属、完成并集与失效子范围；data/memory-commit.js 统一调用失效 |
| 上下文续行 | maintenance/context.js：共享 token 计数、完整交互压缩、独立摘要 adapter；请求总计数由 runner 唯一拥有 |
| Prompt 和工具 | maintenance/prompt.js、tools.js：原样引用生成规则，EditMemory、CompleteMaintenance、按需读记忆与原文 |
| 保存与撤销 | data/memory-commit.js 统一确认；maintenance/commit.js 构造维护差量及收尾记录；summary-history.js 按实际保存顺序附于最新批次 |
| 领域规则 | maintenance/domain.js：事实业务键、完整事件合并、引用校验、原子编辑；不交给模型维护内部字段 |
| 调度 | maintenance/scheduler.js、host.js：同聊天串行，新总结只进入 pending，当前 run 结束后执行；保存确认前不读取新草稿 |
| 参数入口 | maintenance/arguments.js：schema 驱动的格式归一化与具体字段错误；不猜业务内容 |
| 成果展示 | maintenance/history.js、presentation.js、ui.js、copy.js：runId 分组、真实修改、审阅范围和结束状态 |
| 旧数据入口 | summary-history.js 调用 upgradeMaintenanceReceipt，一次性清理原分包元数据；原修改及撤销链不变 |

不依赖小白酒馆、地图或 OS 的启动；只沿用 agent-core 的配置、供应商适配及工具协议，不建通用框架。
work-plan.js、progress.js、refresh.js 及只为旧分包／并入协议存在的测试已删除。
生成内容规则仍由 data/generation-rules.js 拥有，维护引用不改变生成侧全文。

## 施工结果

| 阶段 | 状态 | 契约 |
| --- | --- | --- |
| 单 run 执行 | 已实现 | 读取→看到结果→修改→继续查阅→正常回复，全程保留对话；无需修改时直接回复 |
| 读写时序 | 已实现 | 依目标设计第 6.2 节顺序执行；各列表原子提交；错误在原对话修正 |
| 保存与终止 | 已实现 | 每次修改确认后返回 saved；取消／限额／后续失败保留成果；未确认停止写入 |
| 材料边界 | 已实现 | 输入／压缩阈值按目标设计；全部请求含摘要共用上限，压缩后仍同 run；正文与维护流水不默认注入 |
| 批次选材 | 已实现 | 按目标设计第 5.6 节选材，前批背景不变成待办；开场及 ReadMemory 共用范围过滤，续读保留范围，装载预算经共享计数复核 |
| 范围闭环 | 已实现 | Agent 声明、无修改确认、重复无变化、有效收据派生进度、外部内容变更退役、导入回滚清除 |
| 调度及 UI | 已实现 | 完成／待维护范围、动作、已保存修改及部分完成；保留原布局，没有派工成绩 |
| 历史迁移 | 已实现 | 冻结旧实现生成的真实 v1 收据，入口转换后 v2 运行；差量和退役标记保留 |
| 真实模型验收 | 未完成 | 当前共享凭据只读检查仍拒绝，不重复已知失败的付费 POST；不填虚假的修正率或耗时 |

运行对话、压缩摘要、原文审阅范围、草稿、待执行触发、保存等待及游标仅在内存。逐条记忆送达追踪已删除。runId、收尾 outcome、completion／invalidated 属于现有维护记录，供重启展示及续查，随批次删除或回滚。数据理由及生命周期统一见目标设计第 7 节。
原批次已被回滚或聊天切换时不跨边界追加收尾；此前保存的组显示未收尾，不会恢复付费任务。

## 最少必要验证

- 会话集成：连续读写、普通回复不假冒完成、重复声明、不强制读完、混发顺序执行、多个修改的独立结果、先修改后完成、中断保留完成。
- 参数：省略普通修改 kind、单项列表、数字／布尔字符串、枚举空白与大小写；正文不改写，无效字段返回允许字段且整组不生效。
- 上下文：超过旧 48 次仍可工作；普通与供应商 session 模式多次压缩、完整工具对、独立摘要、token 上限、失败与取消。
- 长聊天：保留 1000 楼 × 1500 字／150 条事实／200 事件首次入场验证；新增 1000／5000 楼已完成历史的选材测试，默认材料只随待维护及衔接内容增长。
- 批次读取：两批 40 楼查询 10–30、非连续待维护、非固定批长、旧事实更新、基线、长记录、删除／合并后分页；超预算重装保留续读入口。
- 存储集成：完整事件合并、引用重定向、同批多次修改撤销、导入基线、人工冲突、跨聊天、未确认保存、旧向量失效。
- 新总结排队：思考／保存／索引／最终收据保存期间不改变旧 run 边界；普通／供应商模式都能冲突→跳过新批次记录→继续其他修改并结束，下一 run 接管更新记录；结论不丢弃，无关新记忆保留、引用变更受保护、跨批穿插保存可精确回滚。
- 加载边界：真实旧收据只转换一次，移除调度元数据而保留逆操作；损坏逆操作仍报错。
- 入口：授权默认关闭，页面打开与保存开关零调用；仅接收总结成功提交通知，不保留手动复审接口。
- 页面：现有布局的状态、展开、原文、长内容、桌面／手机、深浅主题。隔离浏览器与实际存储分别验证。
- 生成侧：一次性核对 HEAD 总结／锚点全文，不留下文案快照测试。
- 固定 24 楼：零 API 预检冻结实现与材料；模型判断质量另记，不使用模拟结果冒充。

## 检查入口

```powershell
node --test modules/story-summary/tests/*.test.js
npm run test:story-summary:runtime
npm run test:story-summary:alignment
npm run test:story-summary:cancel
npm run test:story-summary:bundle
npm run lint
git diff --check
```

受影响宿主与 iframe 入口使用 esbuild write:false 验证链接，不重建无关 APP 产物。
[模型验收脚本](../tests/maintenance-model-check.mjs)默认只预检；实际调用独占创建收据文件，不能重买已有或未知计费请求。
当前质量缺口和所有实际检查结果只记在[验证记录](./memory-maintenance-verification.md)，不将历史通过数当成这轮结果。
