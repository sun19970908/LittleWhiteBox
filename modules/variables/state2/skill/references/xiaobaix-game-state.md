# 变量 2.0：当前状态、模型可见、变化量

前提：小白X 设置里“变量系统”选 **2.0**，变量核心开启；用任务初始化时还需开启循环任务。语法与接口的完整契约在插件 `modules/variables/state2/README.md`，本篇只讲制卡怎样用。

## 1. 变量用来做什么

变量 2.0 保存**当前的完整状态**。每楼记录它做过的修改，删楼、swipe、编辑时自动按记录重算，所以任何时刻读到的都是这条故事线上最新的全部值。

由此分工：

| 谁 | 做什么 |
| --- | --- |
| AI | 每回合只交变化量，不重复输出全部状态 |
| 剧情模型提示词 | 通过取值宏看到当前值，并读取字段含义与玩法事实；负责提交时再读取提交指令 |
| 独立变量更新器 | 读取相同的状态与玩法事实，以及专用更新规则，结算目标正文 |
| 前端 | 读取当前值显示，不依赖正文里的状态文本 |
| 卡 | 定义结构与初值、写清字段含义、玩法事实与更新规则 |

制作时的默认选择与条件分支处理见[主技能的变量流程](<../SKILL.md#制作流程>)。本篇说明所选通道怎样落地，不要求玩家先选择技术协议。

## 2. 结构与初值

`$schema` 锁定结构和类型，约束限定范围，最后写初始数据。下面是角色初始化任务传给 `LWB_StateV2.applyText()` 的文本，不是开场白或剧情模型的输出格式：

```text
<state>
$schema 西厢
  时局:
    日期: ""
    地点: ""
  人物:
    "*":
      在场: false
      好感: 0
      心思: ""
  营救:
    计划已定: false
$range=[0,100] 西厢.人物.*.好感
西厢:
  时局:
    日期: "贞元十七年二月"
    地点: "普救寺"
  人物: {}
  营救:
    计划已定: false
</state>
```

- 初始数据必须写全模板字段，空集合写 `{}` 或 `[]`；缺一个字段，整个根都不写入。
- `"*"` 是名字不固定的成员。新成员按模板整体写入后，才能改它的字段。模板外字段会被拒绝。
- 根名和路径就是模型、前端、取值宏共用的地址，定下后不要随意改。

约束行写在 `$schema` 模板之后、初始数据之前，从行首开始，一行可叠多条：

| 约束 | 写法 | 效果 |
| --- | --- | --- |
| 范围 | `$range=[-100,100] 西厢.人物.*.好感` | 越界截到边界，赋值和加减都管 |
| 单次加减上限 | `$step=15 西厢.人物.*.好感` | 只截加减量，不管直接赋值 |
| 枚举 | `$enum={无人察觉,起疑,盘问,败露} 西厢.风声.等级` | 其他值整条拒绝；用花括号，逗号或顿号分隔 |
| 只读 | `$ro 西厢.人物.*.姓名` | 挡赋值和加减，不挡 push、按值移除、删除 |

路径里 `*` 对应模板的 `"*"` 成员，`[*]` 对应数组每一项。剧情数值（好感、情动、戒备）通常同时要范围和单次上限：范围保证前端与阶段块的阈值有意义，单次上限防止模型一轮跳档。按数值切换人物描写用[阶段块](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#varevent>)。

字段名本身含点号时用引号方括号，例如 `西厢.人物["Lv.3"].好感`；`["00"]` 保留键名 `"00"`，数组下标写 `[0]`。更新规则和提交使用同一条路径。

`$enum` 只给取值真的有限的字段（风声等级、阶段、状态）。地点、称呼、局势这类剧情里会冒出新值的字段不加：模型写出表外的值，这条修改整条被拒，变量停在旧值，玩家看到的是“地点不动了”。这类字段在更新规则里约定写法（例如地点由大到小用“·”连接），前端按约定去认：认得出的段落定位，认不出的尾段如实显示。

当前 `$range` 的边界是数值常量，不能引用另一个变量。涉及动态上限等规则时先说明当前表达边界，不编造语法。

初始化写在「循环任务 → 角色任务」，检查 `applyText()` 返回的 `errors` 并提示失败。

每条开场白是第 0 楼的一个 swipe，各有自己的变量记录（`swipe_info[i].extra`）。`applyText()` 只写进调用时选中的那一条。玩家切到另一条开场白时，那一条没有记录、正文也没有 `<state>`，重算后这个根**整个消失**。

所以用任务初始化时，任务要在两个时机写入：打开聊天时写当前开场白，第 0 楼切换开场白时写新选中的那条。插件 `modules/variables/state2/README.md` 第一节“角色卡有多条开场白时”给的是同一套做法。

- **触发时机用 `chat_changed`，不用 `character_init`。** 循环任务没有“切换 swipe”这种时机，只能由常驻任务自己订阅酒馆的 `MESSAGE_SWIPED`。`chat_changed` 每次打开聊天都会执行，新建聊天也会：酒馆先放入开场白，再发出聊天切换事件。任务重新执行时插件先停止旧实例，所以订阅不会叠加。
- **各套初值写在同一个任务里。** 一份共用的 `$schema` 与约束，加一张按开场白顺序排列的初始数据表，下标 0 对应 `message/0.md`，1 对应 `message/1.md`。只要一套初值时，表里每项写同一段。开场白正文里不放 `<state>`。
- **只在聊天只有开场白时写入。** 切换开场白也只在这时可用。已有后续楼层的旧聊天不补写，避免往有历史的第 0 楼追加记录后重算整条故事线。
- 同一条开场白重复写入相同文本返回 `skipped: true`，不用自己判断是否已初始化。
- 切到别的角色时插件停止本任务，`onCleanup` 取消订阅，不会写进别的卡的聊天。

任务设置 `triggerTiming: "chat_changed"`、`interval: 0`，正文：

```js
const RULES = `$schema 西厢
  地点: ""
  局势: ""`;
const INIT = [
  `西厢:\n  地点: "河中府·普救寺·法堂"\n  局势: "五千贼兵围寺"`,  // message/0.md
  `西厢:\n  地点: "河中府·普救寺·崔家宅院·后堂"\n  局势: "后堂设宴悔婚"`,  // message/1.md
];
const tavern = SillyTavern.getContext();
async function initGreeting() {
  const { chat } = SillyTavern.getContext();
  if (chat.length !== 1) return;
  const data = INIT[chat[0].swipe_id ?? 0];
  if (!data) return;
  const result = await LWB_StateV2.applyText(`<state>\n${RULES}\n${data}\n</state>`, { floor: 0 });
  if (result.errors.length) window.toastr?.error('开局状态未写入：' + result.errors.join('；'));
}
const onSwiped = id => { if (Number(id) === 0) initGreeting(); };
tavern.eventSource.on(tavern.eventTypes.MESSAGE_SWIPED, onSwiped);
onCleanup(() => tavern.eventSource.removeListener(tavern.eventTypes.MESSAGE_SWIPED, onSwiped));
await initGreeting();
```

## 3. 让模型看到当前值

把剧情模型需要的当前值、字段含义和玩法事实放进常驻世界书条目，更新执行者的指令另放一个条目。CardFiles 可直接写回世界书；角色注释 `data.extensions.depth_prompt` 不在当前文件投影内。**模型读到的格式要和它提交变化的格式一致**，所以先按第 4 节确定变化量通道，再选宏。独立变量更新器会自行读取受管状态，不能把“更新器能看到状态”当成“剧情模型也能看到状态”。

### 两类条目分别给谁读

| 条目 | 内容 | 默认设置 |
| --- | --- | --- |
| 当前状态与玩法事实 | 取值宏、字段含义，以及双方都需知道的效果、条件与计算依据；名称由作者决定 | 启用，蓝灯，角色后（`position: 1`），`order: 999`；不要求 D0 或 D1 |
| 更新规则：插件独立更新 | 依据正文和共同玩法事实，什么时候写哪个路径、值怎么填写，以及下文的提交说明 | 标题（`comment`）以 `【小白X变量更新】` 开头，后接自由名称；关闭（`disable: true`），蓝灯（`constant: true`），D0（`position: 4, depth: 0, role: 0`） |
| 更新规则：正文提交 | 同样的改动依据，加正文 `<state>` 格式 | 正常启用，蓝灯，默认 D1；不使用独立更新专用前缀 |

插件只在 2.0 独立更新及其上下文预览中，临时启用本次已加载世界书里匹配前缀的关闭条目副本。原件保持关闭；普通聊天、其他后台请求和 3.0 不作这项处理。条目的其他触发条件、位置、角色、排序、宏及预算处理仍由酒馆执行；常用更新规则不设置概率或互斥组。只读取当前聊天关联并由宿主加载的世界书，不搜索未关联的书。

玩法事实写成世界中的规律，例如装备如何影响防御、哪些条件决定解锁或到期，两边都需要它们来理解结果；“写入哪个路径”“如何填写”“提交 reason”等属于更新执行者的指令。数值与条件在共同的玩法条目中定义一处，更新规则引用它，不再维护另一套公式。已有的共同玩法条目直接沿用；具体字段由卡的玩法决定，不套用示例里的分类。

### 取值宏

| 宏 | 展开成 | 用在 |
| --- | --- | --- |
| `{{xbgetvar::路径}}` | 标量原样；对象、数组输出紧凑 JSON | 独立更新或预设工具通道展示整块状态（模型以 JSON `ops` 提交）；任何通道里把单个值嵌进句子，如“当前地点：{{xbgetvar::西厢.时局.地点}}” |
| `{{xbgetvar_yaml::路径}}` | YAML | 正文 `<state>` 通道展示整块状态：`<state>` 的文字写法也是“路径: 值”的 YAML 风格，读写一致 |
| `{{xbgetvar_yaml_idx::路径}}` | YAML，数组每项带 `# [i]` | 正文 `<state>` 通道，状态里有数组且模型要按下标改写或删除某项。没有下标注释时模型只能猜下标，容易改错项 |
| 酒馆原生 `{{getvar::名}}` | 整个变量 | 只能按变量名取整个值，取不到 `西厢.人物[0].姓名` 这类子路径；不用于变量 2.0 状态 |

路径支持点号和方括号，如 `西厢.人物[0].姓名`。路径不存在或根还没初始化时展开为空字符串；看到空白时先对照变量面板核对实际根名、结构与路径，再检查初始化结果。

展开时机：

- 小白X在提示词组装完成时展开这三种宏，包括独立变量更新器使用的 `dryRun` 组装。`<varevent>` 的条件内容与脚本执行时机见[条件规则与动作](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#varevent>)。
- 模型看不到状态时，核对本次请求中宏展开后的内容，而不是只看世界书里有没有写宏。

更新规则写改动时机和填写要求，不复述当前值；提交格式由通道决定：独立更新用下文的工具示例，预设工具通道由工具 schema 约束，正文通道另附 `<state>` 写法。每条规则以模型提交时要写的**完整路径**开头，按名字新增的成员用 `<人名>` 这类占位，模型不必把嵌套层级换算成路径。

独立更新卡的两个条目内容示例（字段和路径按实际卡结构调整）。第一个是启用的当前状态条目：

```text
[西厢 · 当前状态]
{{xbgetvar::西厢}}

- 人物：按人名记录各人的状态；好感表示其对主角的情感倾向，随明确的情感推进或冲突变化，每段变化幅度不超过 10。
- 时局.地点：当前视点人物所在的位置。
- 营救.计划已定：众人是否已达成营救方案；未定时仍在商议，定下后可进入执行阶段。
```

第二个是按上表配置的关闭更新规则条目：

```text
[状态更新规则]
- 西厢.人物.<人名>.好感：按当前状态条目中的情感变化依据，提交本段剧情造成的增减量。
- 西厢.时局.地点：视点人物换了地方才改，由大到小用“·”连接，如“河中府·普救寺·书斋”。
- 西厢.人物.<人名>：新人物第一次登场时整体写入完整对象，之后的回合只改字段。
- 西厢.营救.计划已定：正文明确写出众人达成营救方案时设为 true；讨论中的提议不算定案。
- 本段没有变化的字段不提交。
```

正文 `<state>` 通道把当前状态宏换成 `{{xbgetvar_yaml::西厢}}`，更新规则条目正常启用，规则写法相同，再附 `<state>` 写法与示例。已有预设工具通道的规则放置遵循该预设自己的读取方式，不能假定它会读取关闭条目。

### 说明每次修改

制作独立变量更新卡时，将下面这段加入专用的关闭更新规则条目，示例路径按实际卡结构调整。它约定更新器提交时的注释，不放进当前状态条目。

```text
## Explaining each change

When submitting variable changes through write, include a "reason" field in each object in state.ops: one short sentence identifying the event in the target passage that supports the change. Base the change on what has happened, rather than predicting what happens next.

An operation may also include "old", the value before the change, to help check the direction and size of the update.

"reason" and "old" are annotations. They are not executed, compared against stored values, or saved in variable history.

Keep these annotations inside their operation objects. Submit through the write tool. Examples (not exhaustive; use the card's actual paths and rules):
```

```json
{
  "state": {
    "ops": [
      {
        "op": "inc",
        "path": "西厢.人物.红娘.好感",
        "delta": 5,
        "old": 50,
        "reason": "主角替红娘解围，红娘主动表达了谢意。"
      },
      {
        "op": "set",
        "path": "西厢.时局.地点",
        "value": "河中府·普救寺·书斋",
        "reason": "众人离开法堂，来到书斋商议。"
      },
      {
        "op": "set",
        "path": "西厢.营救.计划已定",
        "value": true,
        "reason": "正文明确写出众人商定了营救计划。"
      }
    ]
  }
}
```

JSON 当前值里的数组没有下标注释；需要按名字修改的集合，可建模为以名字为键的对象（`人物.<人名>`），让模型直接按名字定位。
## 4. 变化量通道

| 通道 | 谁提交 | 卡需要做的 |
| --- | --- | --- |
| 小白X独立变量更新 | 回复完成后由变量更新器单独请求模型；用户选择手动或自动 | 按第 3 节共享状态与玩法事实，关闭的专用条目只给更新器补充更新指令；不追加正文 `<state>` |
| 预设工具 | 预设把 `LWB_StateV2.getInputSchema()` 挂进工具参数（如 `write.state`），模型以 JSON `ops` 提交，预设用 `beginTurn().commit()` 记到本楼 | 只写第 3 节的状态与更新规则，整块状态用 `{{xbgetvar::路径}}`（JSON）；不写 `<state>` 格式说明，不配隐藏正则 |
| 正文 `<state>`（仅用户特别要求时） | AI 在回复末尾输出 `<state>` 块，消息完成后插件解析 | 整块状态用 `{{xbgetvar_yaml::路径}}`；在规则里写 `<state>` 写法；配隐藏正则 |
| 前端直接 `apply()` | 前端按卡自己的规则结算后调用 | 见第 6 节附录 |

按[主技能的变量流程](<../SKILL.md#制作流程>)确定通道。表中的预设工具一项只适用于确实已有该实现的预设，不能从工具示例推断用户的预设也提供 `write.state`。

### 独立变量更新怎样读取规则

条目分工与设置统一按第 3 节。只适用于特定场景的更新规则可沿用世界书条件触发，插件只临时解除关闭状态，不绕过其他条件。触发、插入位置与排序见[提示词组织](<../../../../card-workspace/skill/references/prompt-organization.md>)。

更新器每次请酒馆重新组装上下文，沿用世界书触发、隐藏、插件注入、排序和裁剪；用自己的变量更新流程组织请求，不替换用户写作预设。它另行读取受管变量的当前值和约束，标出需要结算的最新 AI 正文，只提交这段正文导致的变化。请求预览可以核对世界书规则与宏实际是否进入请求。

用户要求从同步更新切换时，保留双方可读的状态与玩法事实，只将写入要求及提交说明移到第 3 节的专用关闭条目，并取消原先要求剧情模型提交变量的格式指令。同一楼正文 `<state>` 已被变量 2.0 处理时，自动更新会跳过；手动更新仍可执行。这不涵盖其他插件的标签或所有预设工具提交，不能用自动跳过代替通道分工。

保存卡文件不会执行初始化，也不会替玩家开启自动更新。按第 2 节启用初始化任务，再在变量面板确认当前值；变量更新页配置模型与手动/自动方式。核对位置：插件 `modules/variables/updater/context.js`、`world-info.js`、`host.js` 与 `modules/variables/shared/context-capture.ts`。

### 用户特别要求正文提交时

正文 `<state>` 的写法（加减带 `+`/`-`，赋负数加括号 `(-5)`，路径写到最底层）见插件 `modules/variables/state2/README.md` 的「二、剧情中：让 AI 在回复里改变量」。隐藏正则放进卡内正则（`regex/`），同时设置 `markdownOnly` 与 `promptOnly`，只改显示和发出的提示词：

```json
{
  "scriptName": "隐藏状态块",
  "findRegex": "/<state>[\\s\\S]*?<\\/state>/g",
  "replaceString": "",
  "placement": [1, 2],
  "markdownOnly": true,
  "promptOnly": true,
  "runOnEdit": true,
  "disabled": false
}
```

## 5. 前端读取当前值

```js
function readState(root) {
  const raw = SillyTavern.getContext().variables.local.get(root);
  if (raw === '' || raw === undefined) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
```

楼层 iframe 里用 `window.parent.SillyTavern`。返回 `null` 表示当前聊天还没有这个根，界面要显示“尚未初始化”而不是报错。

面板按[变量刷新](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#state-panel-refresh>)读取和更新显示。完整的 2.0 iframe 面板见[状态面板示例](<examples/state2-direct/panel.html.txt>)，包含初次读取、变化比较、定时刷新、失败反馈与卸载清理。

<a id="state-atoms"></a>
**要知道“这一回合改了什么”时，在任务里订阅变化通知。** 轮询只看得到结果，分不清是新提交还是回滚。插件每次真实写入（正文 `<state>`、`applyText`、`apply`、预设的 `beginTurn().commit()`）和切 swipe 重算后，在父页面 `document` 上触发 jQuery 事件 `xiaobaix:variables:stateAtomsGenerated`，参数 `{ messageId, atoms }`，每个 atom 带路径、`oldValue`、`newValue`。删楼、删 swipe 后插件只重算，不发这个通知。所以：

- 动画、音效、提示这类“只在发生变化时做一次”的效果，订阅它；界面显示的当前值仍靠轮询。
- 只在循环任务里订阅，用带卡专属命名空间的 `$(document).on('xiaobaix:variables:stateAtomsGenerated.我的卡', …)`，`onCleanup` 里 `off` 掉。楼层 iframe 不往父页面挂监听（[能力参考 3.3](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md>)）。
- 用 `silent: true` 调用 `applyText` 时不发通知。

纯界面偏好（面板展开、当前标签页）用带卡前缀的普通本地变量，不进变量 2.0。

守卫按结构和范围校验，不区分是谁写的：模板外字段、类型错误会被拒绝，超范围会被截到边界；但挡不住模型在范围内改了不该它改的字段，这要靠更新规则约束。

<a id="frontend-settlement"></a>
## 6. 附录：前端按游戏规则结算

只在数值由游戏规则决定、而不是由剧情决定时使用，例如经营卡的金钱、时间、体力。前端按钮算好结果后直接调用 `apply()` 结算，见本节末尾的[直接结算示例](<#direct-state-example>)；结果常驻在变量里，前端随时读取，消息正文不需要携带状态。

**用户特别要求随玩家消息提交时**：前端算好结果，把摘要和 `<state>`（写绝对值）填进输入框发送，记在玩家这一楼。

```js
function buildStateBlock(changes) {
  const lines = Object.entries(changes).map(([path, value]) => {
    const encoded = JSON.stringify(value).replace(/</g, '\\u003c');
    return `sim.${path}:\n  ${encoded}`;
  });
  return `<state>\n${lines.join('\n')}\n</state>`;
}
```

发送、命令解析与生成期间的按钮处理按[公共消息按钮指导](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#message-buttons>)，与玩家手动发送走同一条路；该规则也适用于不携带状态块的普通消息。

<a id="direct-state-example"></a>
**直接结算**：[初始化任务](<examples/state2-direct/init.task.js.txt>)与[楼层面板](<examples/state2-direct/panel.html.txt>)演示 `apply()` 的完整回执处理。

初始化示例是单开场白任务的 JS 函数体，写进任务脚本时包在 `<<taskjs>>` 与 `<</taskjs>>` 中；多开场白按第 2 节调整。面板是独立 HTML，放进楼层时用 HTML 代码块包住。它们是可按需复制的例子，不会因读取技能自动安装。

- `apply()` 记在**调用时的最后一楼**，不是面板所在楼。
- 分别处理 `success`、`partial`、`noop`、`failed`。部分成功只重发失败项，不整批重发。
- 提交后重读真实值显示，不把请求量直接加到旧画面上。

通用验收见[主技能的玩法验收](<../SKILL.md#玩法验收>)；直接结算还要核对部分成功时是否仅重试失败项、规则修正后的真实值是否显示、失败是否明确提示。

<a id="write-entries"></a>
## 7. 附录：写入入口与恢复规则

以下入口共用同一套操作与 `$schema`/`$range` 守卫（完整语法与契约见插件 `modules/variables/state2/README.md`）。另有供预设使用的 `beginTurn({ floor, swipeId }).commit({ ops })`，用于工具调用提交本楼变化量，重写时只撤销本楼上一次这样的提交；卡一般不直接调用。

1. **正文 `<state>`**：AI 回复或玩家消息里的 `<state>…</state>`，只在用户特别要求正文提交时使用。支持文本写法（`路径: 值`、`路径: (负数)`、`路径: +5`）或 JSON 写法（以 `{` 开头，格式同 `apply`）。插件不会自动把标签从显示和提示词中去掉；卡选用这条通道时需配正则隐藏（`markdownOnly: true` 且 `promptOnly: true`）。
2. **`await LWB_StateV2.applyText(text, { floor, silent })`**：用文本写法直接执行一段 `<state>`。
   - **角色任务初始化受管根变量（声明 `$schema`、约束并写入完整初始数据）用它**。模板里有的固定字段，初始数据必须写全（空集合也要写 `{}` 或 `[]`），缺一个字段整份根变量都不会写入。
   - 返回 `{ atoms, errors, skipped }`，`errors` 为空数组表示全部成功。
   - 作为独立调用条目追加到目标楼层（默认当前最后一楼），**不会覆盖**该楼的正文记录或其他调用记录。
   - 同一楼已经执行过完全相同的文本会跳过（`skipped: true`）。
3. **`LWB_StateV2.apply({ ops })`**：结构化 JSON 写入，适合前端按钮、结算脚本和工具调用，不需要往聊天里发消息。
   - `ops` 是操作数组；各操作的字段见下方说明。
   - **只能修改已通过文本入口初始化过的受管根变量**，不能新建根变量，也不能声明 `$schema`。
   - 同步执行并立即返回 `{ status, changes, corrections, errors, warnings }`（`status` 为 `'success' | 'partial' | 'noop' | 'failed'`）。
   - 每次调用都会执行，记在调用时的最后一条消息上。**已经通过 `apply()` 改过的操作，不要再写进消息正文**，否则会执行两次。
   - 格式错误时整批不执行，修好可整批重发；`status === 'partial'` 时成功项已生效，只修正并重发失败项，不要整批重发；`warnings` 是提交后的附带通知问题，不要因此重试。

初始化、读取、检查回执、重读与界面刷新见上文的[直接调用完整示例](<#direct-state-example>)。

在任务中使用 `window.LWB_StateV2`；同源楼层 iframe 使用 `window.parent.LWB_StateV2`。`apply()` 的动作字段按操作填写：`set/push/remove` 用 `value`，`inc` 用 `delta`，`del` 只需路径。`changes` 是实际变化，`corrections` 是规则修正；界面最终值来自重新读取当前变量，而非把请求量直接加到旧画面上。批操作不是事务，不能用“有一个回执”代替检查各项结果。

**恢复规则与守卫边界：**

- **按请求重演**：每条消息在各自的 swipe 上记录做过的操作。删消息、切 swipe 时，按保留下来的请求重新计算。重新打开同一聊天只载入保存状态并扫描受管范围，不重新执行请求；新建聊天从该聊天的初始化开始。
- **编辑与删除状态块**：编辑任意楼层的 `<state>` 都会从该楼起重新计算后续楼层；继续生成（continue）只执行新增的块；把消息里的 `<state>` 全部删光会**保留**该楼已生效的记录（方便清理正文，不等于撤销），删掉其中一部分块则会按剩余块重算。
- **守卫 ≠ 记账**：`/xbsetvar`、`/xbaddvar`、`/xbpushvar`、`/xbdelvar` 在变量核心开启时经过守卫校验，但直接改本地变量，**不进变量 2.0 的楼层请求记录**，重算时会被覆盖。受管根变量一律走上面三个入口；原生 `variables.local.set`、`/setvar` 只用于带卡前缀的普通界面变量。
