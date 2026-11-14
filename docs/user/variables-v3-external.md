# 在外部制作变量 3.0 角色卡

适用于在本地文件夹、Git、编辑器或外部 AI 工具中制作角色卡的人。流程是：创建或解包规则目录 → 编辑 → 离线检查和试算 → 打包进卡 → 导入酒馆。后续同步到正在使用的卡时，再通知页面重新读取规则。

规则随角色卡携带；聊天进度由酒馆保存。浏览器卡片工作区和外部目录各自持有编辑稿，保存或同步时需处理冲突。

## 开始制作

安装 Node.js 18 或更新版本，在 LittleWhiteBox 目录执行：

```sh
node dist/tools/state3.cjs init my-card
node dist/tools/state3.cjs check my-card
node dist/tools/state3.cjs pack my-card my-card/card.json my-card-ready.json
```

`init` 创建可运行的“护符与生命”示例及 `card.json`。在 `card.json` 中编写角色设定、开场和世界书，在 `variables/` 中编写规则。`my-card-ready.json` 可直接导入酒馆；玩家启用 3.0 后使用卡上规则，无须再导入一次规则包。

处理现有卡：

```sh
node dist/tools/state3.cjs unpack original.png my-card
node dist/tools/state3.cjs check my-card
node dist/tools/state3.cjs pack my-card original.png updated.png
```

`unpack` 提取规则目录，保留原卡作为角色资料和图片的来源。`pack` 支持 Character Card V2/V3 的 JSON、PNG，输入与输出扩展名相同，只替换规则字段，保留其他卡资料；PNG 中同时存在 `chara`、`ccv3` 时两份都更新，图像数据保持不变。

所有输出文件或目录必须尚不存在；输入文件不会被覆盖。输出位置冲突、规则不合格或开局失败时，命令失败并保留原文件。规则目录中的源码文件须使用下文规定的名称，不接受子目录或符号链接。

工具随插件统一构建，安装用户无须安装 npm 依赖。单独复制工具时一并携带 `dist/tools/state3-LICENSES.txt`。插件升级后使用对应版本工具。

## 离线检查与试算

```sh
node dist/tools/state3.cjs check my-card
node dist/tools/state3.cjs check updated.png
node dist/tools/state3.cjs try my-card actions.json
```

`check` 读取目录、卡文件或独立规则包，检查结构、引用、阶段权限、依赖关系，再计算共用开局及每条备选开局。`pack` 使用同样的检查，通过后才生成卡。

`actions.json` 是操作数组，例如对示例卡卸下护符：

```json
[{ "action": "unequip", "params": {} }]
```

`try` 默认从开局计算；结果中 `state` 是试算后的完整变量，`changes` 是变化，失败时 `diagnostics` 给出原因。可选参数：

| 参数 | 含义 |
| --- | --- |
| `--state state.json` | 从文件中的完整状态对象开始，方便接续试算 |
| `--opening 0` | 选择从 0 开始的开场序号；指定 `--state` 时以该状态为准 |
| `--stage before` / `--stage after` | 按对应更新阶段检查操作权限；省略时使用卡侧 API 的试算方式 |
| `--prepared prepared.json` | 显式提供准备数据脚本的模拟结果 |

计算函数和 `calculate` 脚本在与页面相同的隔离计算环境中运行。工具、`prepare` 和 `committed` 脚本不在离线检查或试算中执行；需要网络、酒馆或真实随机源的流程，在隔离聊天中试玩验证。

命令输出 JSON，成功退出码为 `0`，失败为 `1`。`--help` 显示用法。`schema` 输出当前 `format`、`cardExtension` 和 `definition` 的 JSON Schema，编辑器可直接使用；它来自插件的格式定义。规则语义和玩法字段见[变量 3.0](variables-v3.md#规则文件里分别写什么)。

## 对外格式契约

### 卡字段与版本

Character Card V2/V3 的规则存放在：

```js
card.data.extensions['lwb-state3'] = JSON.stringify(bundle);
```

该字段的存储值是 **JSON 字符串**。规则包包含必填 `definition` 对象、必填 `functions` 对象，以及可选 `tools`、`scripts` 对象。三个源码集合的值均为 JavaScript 源码字符串；无自定义函数时 `functions` 为 `{}`。未配置的 `tools`、`scripts` 可省略。

`definition.format` 当前为 `1`，作为整套规则交付契约的版本。键名、字段含义、目录映射及结算语义属于对外契约；内部重构维持该契约。发生破坏性变更时提升此版本，旧公开格式在解析入口按冻结样本一次性转换，再进入当前模型。未知版本明确报错。本版本只接收格式 `1`，不包含其他历史格式转换。

只替换这个扩展字段，保留其他 `data`、`extensions` 字段。通过 SillyTavern `/api/characters/merge-attributes` 更新时，完整替换字符串叶子，避免已删除的函数或脚本因对象合并残留：

```js
const response = await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: SillyTavern.getContext().getRequestHeaders(),
    body: JSON.stringify({ avatar, data: { extensions: { 'lwb-state3': JSON.stringify(bundle) } } }),
});
if (!response.ok) throw new Error(`写卡失败：HTTP ${response.status}`);
await window.LWB_StateV3.refreshRules({ avatar });
```

这里的 `avatar` 是同步工具已确定的目标卡文件名，`bundle` 是已检查的完整规则包。该段代码在酒馆同源页面或同步工具的页面桥接中执行，沿用酒馆认证与请求头。

### 目录映射

路径相对一张卡的项目目录；源码文件名由英文字母、数字、下划线、短横线组成。

模型工具名使用更严格的供应商接口约定：以英文字母或下划线开头，仅含字母、数字、下划线，最长 64 个字符，并避开内置提交工具名。以检查器的验证结果为准。

| 文件 | 规则包字段 | 内容 |
| --- | --- | --- |
| `variables/definition.json` | `definition` | JSON 对象，含规则、源码声明和扩展配置 |
| `variables/functions/<名称>.js` | `functions[名称]` | 完整计算函数表达式 |
| `variables/tools/<名称>.js` | `tools[名称]` | 模型工具函数体 |
| `variables/scripts/prepare.js` | `scripts.prepare` | 准备数据函数体 |
| `variables/scripts/calculate.js` | `scripts.calculate` | 隔离计算函数表达式 |
| `variables/scripts/committed.js` | `scripts.committed` | 提交后函数体 |

源码声明位于 `definition.functions`、`definition.extensions.tools`、`definition.extensions.scripts`，需要与源码集合对应；检查器负责验证。空可选集合与省略该集合表达相同含义，解包再打包时空可选集合会省略。源码文本保持原样，JSON 缩进和键顺序不作为语义。

浏览器工作区的 `originalContent`、`originalGroupHash` 用于编辑冲突检查，属于工作区记录，不写进规则包。外部目录无须保存这些字段。

## 同步到正在使用的卡

酒馆界面导入卡片时沿用宿主重新加载流程。只调用后端 `merge-attributes` 的工具，在写入完成后调用页面接口：

```js
const result = await window.LWB_StateV3.refreshRules({ avatar });
```

`avatar` 必填，须与当前选中的卡一致；可传 `signal` 取消读取。返回 `{ ok: true, changed, version }`：`changed` 表示页面规则字段是否改变，`version` 是当前规则内容摘要（供比较，不是格式版本号）；无规则字段时为 `null`。已启用 3.0 的聊天若规则被删除或损坏，会明确报错。

接口重新从服务器读取这张卡，只更新页面中的规则字段，完成说明宏刷新后返回。规则变更会取消旧的模型更新、使旧规则下的待提交操作失效。当前变量、历史结算和编辑草稿均保留；已有变量在下一次结算时按新规则计算。读取失败、切换角色、读取期间发生本地存卡或取消时，调用失败；同步工具应把失败显示给作者。

纯后端工具需通过自己的页面桥接完成此调用，或者由用户重新加载酒馆页面。插件不后台轮询所有角色卡。外部同步写入成功和页面刷新成功应分别处理，刷新失败时只重试刷新。

### 双方都在编辑时

外部工具在读取卡时保存规则包基线，写入前重新读取并比较；发生冲突时让作者选择和合并。插件工作区已有同类整包冲突检查，会保留草稿并拒绝覆盖外部新规则。刷新规则不会替作者合并两个编辑稿。

SillyTavern 的 `merge-attributes` 没有比较后写入的原子条件参数。同步工具应串行提交同一张卡，写后读取核对；涉及多方同时写入时，由同步工具协调。

## 维护与验收边界

功能源码由 `modules/variables/state3/` 持有。文件转换共用 `definition/card-files.ts`，格式共用 `definition/format.ts`，检查和试算共用编译器及结算引擎。离线入口只负责参数、文件读写和卡容器；通过统一构建登记生成 `dist/tools/state3.cjs`。不新增长期状态或第三方依赖。

删除离线能力时删除 `offline/`、构建入口登记及对应文档、测试，统一重建移除产物。用户自行保存的卡和目录保留；页面刷新随 3.0 功能生命周期释放。

| 验收契约 | 出错代价 |
| --- | --- |
| O1：外部目录与 JSON/PNG 卡往返保留全部规则源码，其他字段和图像保持不变 | 丢规则、丢卡资料 |
| O2：离线检查覆盖所有开局，试算与页面共用引擎，检查不执行宿主副作用 | 错误规则交付、意外外部操作 |
| O3：未知版本、坏卡、检查失败或输出位置冲突时，原文件和已有输出保持不变 | 丢文件、损坏角色卡 |
| O4：刷新后规则与宏一致，进度和草稿保留，旧操作失效，坏规则明确报错 | 静默错误结算、丢进度或草稿 |
| O5：切卡、并发存卡、取消和读取失败时，迟到的刷新不能覆盖当前数据 | 写错角色、丢规则 |
| O6：分发工具脱离源码和 node_modules 后仍可检查、试算和打包，失败返回非零退出码 | 外部流程中断、错误交付 |
