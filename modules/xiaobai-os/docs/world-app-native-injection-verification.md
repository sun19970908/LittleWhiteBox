# 世界 APP：原生 ↑Char 接入验证

日期：2026-09-06。**历史记录：下文描述的是当时被停止的 ↑Char 方案。用户随后明确改用 System @D4，已恢复并完成首版功能施工；本记录的“未实施／暂停”仅指该次探针结束时的状态，不是当前阻塞。** 当前实现与 D4 验证见 [施工记录](./world-app-implementation-plan.md)。

## 当时结论（仅针对 ↑Char 事件方案）

**“在世界书加载事件中添加临时条目”的接法未通过请求隔离。当时按停止条件暂停在适配验证层，没有将该接法接入正式 World APP。**

位置本身成立：临时 `before` 条目可以进入原生 `worldInfoBefore`，并遵守世界书预算。失败的是请求归属：同一个加载事件也供后台 dry-run 扫描使用，但参数没有调用来源、请求 ID 或 dry-run 标志。不能从“主生成窗口仍然打开”推出当前事件属于主生成。

这不是“↑Char 永远做不到”的结论；它说明当前选定的事件接法不足以兑现隔离契约。新的接法必须先明确可靠的请求边界，再恢复后续施工，不能擅自放宽隔离、修改宿主或退回其他注入位置。

## 验证环境与方法

- 本地 SillyTavern 1.18.0，Playwright CLI 启动独立浏览器会话；服务仅监听 `127.0.0.1:8097`。
- 独立数据根为仓库内已忽略的 `output/playwright/world-native-gate/data`，使用默认资料并关闭扩展加载、扩展自动更新与服务插件；未加载真实用户存档。
- 初次跳过默认内容复制导致设置缺失，补齐隔离目录的默认资料并完成欢迎流程后重新执行，最终结果仍一致。未将初次初始化错误当作隔离失败证据。
- 调用宿主真实 `getWorldInfoPrompt`，分别传入 `isDryRun=false/true`；两者均传 `trigger: normal`，与宿主正常主扫描、现有 OS 后台捕获一致。
- 另外将现有 `createHostPromptContextAdapter` 原样打包到忽略目录，使用测试聊天身份、测试正文和宿主真实 `getWorldInfoPrompt` 运行 `capture()`，检查正式归一化后的 `contextSnapshot.worldInfo`。
- 探针只插入固定测试标记；没有调用 `Generate`、新闻 Agent 或模型生成 API，没有保存世界书。临时监听通过 `finally` 注销。

开发探针与隔离配置位于 `output/playwright/world-native-gate/`，不进入发布包。它验证原生扫描边界，不等同于完整聊天生成或真实新闻质量验收。

## 实测结果

| 场景 | 实际结果 | 判断 |
| --- | --- | --- |
| 无绑定世界书、没有探针监听 | before／after 都为空 | 空基线成立 |
| 向加载结果添加临时 before 条目 | 标记只进入 `worldInfoBefore`，不在 after／depth | 原生位置成立 |
| 同一监听下运行后台 dry-run | 标记仍进入后台 `worldInfoBefore` | 后台污染 |
| 主扫描与后台扫描 `Promise.all` 交错执行 | 两者都取得新闻标记 | 窗口监听不能隔离 |
| 正式 OS `capture()` 接真实宿主扫描 | `contextSnapshot.worldInfo` 含新闻，捕获错误为空 | 现有后台上下文链路确实受影响 |
| 只让首个加载事件添加条目；挂起后台首事件，再启动主扫描 | 后台有新闻、主扫描没有 | “只消费下一次事件”也不成立 |
| 在 `WORLD_INFO_ACTIVATED` 中修改已激活条目 | 事件触发，但返回的 before 字符串不变 | 最终激活事件晚于文本拼装 |
| 极小上下文预算，`ignoreBudget=false` | 新闻被省略 | 原生预算生效 |
| 注销监听后再次读取 | 标记不再出现 | 探针监听已清理 |

所有加载回调均只有一个参数，其键是 `globalLore`、`characterLore`、`chatLore`、`personaLore`。主扫描和后台扫描的参数结构相同。

复现断言全部通过，含义是上述污染与误占已稳定复现；`isolationGatePassed=false`，不是功能验收成功。

## 源码证据与替代方向的约束

下列 ST 路径相对宿主 `public/`，只读核对，未修改：

- `scripts/world-info.js:4478`：`getSortedEntries()` 没有扫描上下文参数；`:4492` 发出加载事件时只有四组条目数组。
- 同文件 `:4597`、`:4632`：`checkWorldInfo` 持有 dry-run 和扫描数据，但调用 `getSortedEntries()` 时未传下去。
- 同文件 `:4695`：条目 generation-type 过滤读取 `globalScanData.trigger`，不能区分同为 normal 的主扫描和后台捕获。
- 同文件 `:5031`、`:5056`：扫描完成事件同样没有请求身份和 dry-run 参数；不能作为已经查证的请求隔离入口。
- 同文件 `:892`：先等待扫描结果并取得已拼装的 before／after 字符串，随后才在非 dry-run 时发出 `WORLD_INFO_ACTIVATED`。监听这个后置事件修改条目不能回写此前的字符串。
- `script.js:4565`：主生成构造独立扫描正文和扫描数据后调用同一 `getWorldInfoPrompt`。
- 仓库 `modules/xiaobai-os/host/prompt-context/capture.ts:153`：后台使用 `getWorldInfoPrompt(..., true, globalScanData)`；`:98` 的 trigger 同样是 normal。
- 仓库 `modules/draw/shared/scene-planner.js:144` 也直接调用原生 dry-run 扫描。只让 World 与 OS 自己的读取互斥，仍不能声称隔离了所有调用方；修改后台 trigger 还会改变作者条目的匹配语义。

不能通过事后从后台结果删除新闻来冒充隔离：扫描期间已经可能消耗预算、改变条目取舍。也不采用临时关监听加全局布尔标志或未知调用栈识别来弥补请求身份缺失。

## 未验收与后续边界

- 未执行两类补全的最终请求定位、用户预设重排／关闭 ↑Char、群聊生成、取消／切聊天完整生命周期；基础请求隔离失败后没有继续正式 APP 施工。
- 未实现领域／工具／持久化／UI，未调用真实 World Agent，不存在模型质量验收结果。
- 生产代码与 dist 没有改动，不为文档和探针重建发布包。此次只做探针语法、文档链接及 diff 检查；正式 OS 测试、类型、lint、imports 与构建仍属于后续实现验收。
- 产品位置仍是 ↑Char，订阅规则和刊物式 UI 保持已确认方案。下一步需重新审阅注入适配边界；若方案要求修改宿主、接管其他调用方或改变产品契约，需单独确认后才能实施。
