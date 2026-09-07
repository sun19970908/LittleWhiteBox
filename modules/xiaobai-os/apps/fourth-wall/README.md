# 四次元壁 APP

四次元壁拥有自己的聊天状态、Prompt、前台生成、实时吐槽、媒体协议和 UI。跨层契约集中在`types.ts`，领域与宿主运行时使用 TypeScript，界面使用 Vue + TypeScript。

用户级偏好只经过小白 OS 设置仓库；聊天会话只写当前 sidecar 的`fourthWall`分区。iframe 只接收可序列化 APP 状态，不接收 sidecar Envelope、其他分区或共享 Agent API 密钥。
