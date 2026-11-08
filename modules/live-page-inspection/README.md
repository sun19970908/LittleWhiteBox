# 活页面检查

功能所有者是本目录。助手通过 InspectPage 只读访问当前聊天的存活 iframe；源码修改仍使用文件工具和 CardFiles。

- service.ts：宿主页面与文档生命周期、临时页面/元素标识、工具分发及续读。
- dom.ts：实际 DOM、布局、样式和命中测试。不会点击、刷新或执行助手提交的脚本。
- recorder.ts：页面异常、未处理拒绝、console.error/warn、资源元素加载失败；保留浏览器原来的事件、控制台调用和返回值。
- instrument.ts：小白X渲染 HTML 时，在 head 最前面同步接入捕获。Blob 缓存复用时不携带特定页面标识。
- contract.ts：动作、容量、错误及界面表达的唯一来源；tool-contract.ts 和 prompt.ts 是助手接入说明。

## 记录与读取

诊断仅保存在宿主内存：总字符容量与总条目数均有上限，旧记录按顺序淘汰，结果明确报告淘汰/省略。记录不引用 DOM、Error 或日志参数对象，不接触酒馆聊天和角色卡存档。

页面关闭、文档替换或切聊天时释放对应监听与记录；插件清理时释放整个服务。页面和元素标识不跨文档复用。嵌套页面随外层页面一起失效。

DOM 和样式结果按需读取，不缓存完整页面副本。长结果返回 next，原样再次调用即可继续；每页是即时读取，revision 变化代表 DOM 发生过修改，不应把变化前后的两页拼成同一个快照。documentId 防止续读进入被替换的文档。

小白X渲染的页面在作者脚本之前开始捕获。已由别的插件打开的同源页面，从接入时起捕获，不能追回此前异常。跨域/沙箱页面如受浏览器限制，会返回外层信息与不可访问原因。资源捕获观察浏览器的资源 error 事件，不改写 fetch/XHR，也不把所有 HTTP 非成功响应当成页面异常。

移除功能：删本目录、渲染器接入及助手工具/提示词注册即可；没有持久化数据需要迁移或清理。

## 修改后复查

文件工具和 CardFiles 负责修改与保存；现有 RunJavaScriptApi 先调用酒馆 updateMessageBlock，再调用渲染器 processMessageById，只重建目标楼层显示。渲染入口在 modules/iframe-renderer/assistant-api.ts 注册，宿主执行与助手审批共用 modules/assistant/shared/extension-jsapi-manifest.ts；不增加修改或刷新工具，也不广播消息事件。托管宿主仍由宿主负责重建。

具体操作与副作用边界见 references/verify-changes.md。成功回执不表示页面已加载，须用 InspectPage 读取替换后的页面确认。截图用于澄清视觉意图，不替代已有的内部故障证据。
