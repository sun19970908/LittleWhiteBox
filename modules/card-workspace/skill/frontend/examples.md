# 前端示例索引

下面的路径从插件目录算起，用 Read 打开。每个例子只演示一块能力；做整张卡时，按前端技能里"先走一遍玩家的路"的顺序把它们组合起来。

## 聊天卡：把一楼文字排成画面

- `docs/user/render.md`：AI 回复或开场白里的 HTML 代码块怎样变成能点的小网页，网页里怎样执行酒馆命令、调用 AI 生成、知道自己在第几楼。从这里开始做按钮和本楼交互。
- `docs/user/template.md`：AI 只输出地点、时间、正文几个字段，模板把它们填进固定版式，生成过程中实时更新。适合每楼长得一样的卡。
- `docs/user/media-api.md`：里面的 `html draw-example` 和 `html tts-example` 是能直接跑的画图、语音组件，带取消、失败提示和结果显示。

## 带变量的面板

这些例子主要教变量怎样结算，面板只是让玩家能操作、看到结果：

- `modules/variables/state3/skill/references/examples/camp/`：变量 3.0 的营地面板，按钮提交动作，条件不满足时告诉玩家原因。
- `modules/variables/state3/skill/references/examples/jieling.md`：解铃会，一张完整的变量 3.0 示例卡。故事里接待来访者、旁听、听汇报，面板上分室、处理事件、结束一周。
- `modules/variables/state2/skill/references/examples/state2-direct/`：变量 2.0 的初始化和面板直接写入。

## 固定界面的卡

挂载、卸载、与聊天来回切换，读[重型前端参考](<../references/xiaobaix-heavy-ui.md>)。插件目前没有附带一整张固定界面、自己保存回合历史的成品卡；做这类卡时，生成、画图、语音可以复用上面的组件，回合和存档按前端技能里选定的做法自己实现。
