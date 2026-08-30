# 小白x二改（随时更新）：

原仓库：https://github.com/RT15548/LittleWhiteBox
本仓库：https://github.com/sun19970908/LittleWhiteBox
修改部分包括：index.js 、story summary  、\integrations\tauritavern-chat-surface
几乎所有更改都有开关，随时可关闭

1. 阻断了participant 注册实现了tauritavern的虚拟化时酒馆助手和小白x的部分兼容，需要二改的tauritavern和循环任务开关，并增加一个剧情总结的QR按钮
2. 解锁了虚拟化时小白x的按钮，实测draw没问题，别的不清楚
3. 增加一个延迟总结功能，需要循环任务
4. 可以改剧情总结的预算，需要循环任务
5. 剧情总结允许speaker留空，方便导演模式，以免llm混淆导演和角色，需要循环任务
6. timeLabel 规则加强：剧情总结的timeLabel 要求用原文绝对时间，适用于长聊天
7. 修复向量召回词法零命中的问题
8. 优化向量召回distance太少的问题（就是梗概）
9. 解除向量召回超时限制，防止手机太慢超时
10. lexical加了个截断防止lexical太多
11. lexical可缓存，防止初次召回太慢，如果出错就用循环任务删除缓存
12. reranker doc 截断，防止reranker doc 太长
13. L3 人物屏蔽功能（可以按主体屏蔽 + 完全屏蔽 world + 完全屏蔽 people），需要循环任务
14. 可选屏蔽l3（定了的事）里的核心事实相关人物（state约束），防止长聊天l3太多
15. 剧情总结提示词可以后处理取消预填充防止gemini 3.7f不支持，需要循环任务

# 另附几个我写的实用循环任务：
1. 向量补全
2. novelai指定楼层生图
3. 向量自动备份（只适用于Sillytavern，以防聊天丢失，tauritavern不需要而且会卡）
4. 捕捉llm发送和返回的内容（tauritavern不需要）

循环任务在仓库里
二改tauritavern：https://github.com/sun19970908/TauriTavern
还有一个酒馆助手脚本，发送之前的最后正则，可以对变量列表等一切提示词正则：


---
# LittleWhiteBox

一个面向 SillyTavern 的多功能扩展，包含剧情总结/记忆系统、变量系统、任务与多种面板能力。集成了画图、流式生成、模板编辑、调试面板等组件，适合用于复杂玩法与长期剧情记录。

## 许可证

详见 `docs/LICENSE.md`
