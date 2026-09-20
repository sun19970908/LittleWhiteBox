# 小白X 通用画图面板架构设计

> 分支：`feat/unified-character-tags-ui` · 状态：Phase 1 进行中 · 2026-09-20

## 1. 背景与目标

**现状**：三个 provider（novelai / comfyui / sd-webui）各自维护一套独立设置面板（`novel-draw.html` / `comfy-draw.html` / `sd-draw.html`），UI 大量重复——角色标签、场景 Agent、绘图参数、世界书等各有三份实现，功能演进三处同步。

**目标**：以 novelai 面板为基座演化为**单一通用画图面板**，通过全局 `drawProvider` 开关决定：
- 显示哪些 view（novelai 专属 / comfyui 专属 / 共用）
- 数据写入哪个 provider 的 settings

生成引擎、出图流程、浮窗入口保持各 provider 独立，**只统一设置面板**。

## 2. 核心架构

```
┌─────────────────────────────────────────────────┐
│          通用画图面板（novel-draw.html 演化）        │
│  ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │ NAI view │ │ Comfy view │ │ Shared view   │   │
│  │ (novelai)│ │ (comfyui)  │ │ (双 provider)  │   │
│  └────┬────┘ └────┬────┘ └────────┬────────┘   │
│       │           │               │            │
│       ▼           ▼               ▼            │
│  显隐由 drawProvider 开关统一控制                │
└───────┬───────────┬───────────────┬─────────────┘
        │           │               │
        ▼           ▼               ▼
  novelai 宿主  comfyui 宿主    shared 层
  (novel-draw.js) (comfy-draw.js) (character-prompts 等)
        │           │
        ▼           ▼
  novelai settings  comfyui settings（独立存储）
```

**三个关键机制**：

1. **View 归属标记**：缝入的 comfy view 保留 `data-comfy-view-panel` / `comfy-*` id 前缀，与 NAI view 的 `nd_*` 命名空间天然隔离，互不冲突。

2. **跨宿主函数复用**：comfy-draw.js 将 view 函数加 `export` 导出，novel-draw.js 直接 `import` 复用；comfy 侧 `getSettingsDocument()` 增加 novel iframe 兜底，使同一函数能操作两个 iframe 的 DOM。

3. **数据归属不迁移**：各 view 的数据仍写入所属 provider 的 settings（comfy view 写 comfy settings），面板只是操作界面，不做数据合并。共享数据（角色标签等）继续走 shared 层。

## 3. 分层职责

| 层 | 内容 | 职责 |
|---|---|---|
| **面板层** | novel-draw.html（唯一） | 承载全部 view 的 HTML/CSS，按开关显隐 |
| **宿主层** | novel-draw.js / comfy-draw.js / sd-draw.js | 面板生命周期、各 provider 生成流程、settings 读写 |
| **复用层** | comfy-draw.js 导出的 view 函数 | 被通用面板 import，单份实现多处使用 |
| **共享层** | shared/（character-prompts、danbooru-local-db 等） | 平台无关工具，已存在 |

## 4. 开关机制

- 复用 LWB 已有全局开关 `drawProvider`（settings.html「画图后端」选择器）
- 面板初始化时宿主将 `drawProvider` 传入 iframe，面板据此显隐各 view
- `drawProvider=novelai`：隐藏 comfy view，显示 NAI view
- `drawProvider=comfyui`（Phase 2）：隐藏 NAI view，显示 comfy view

## 5. 阶段规划

| 阶段 | 内容 | 状态 |
|---|---|---|
| **Phase 1** | NAI 面板缝入 comfy 工作流 / 绘图参数 view；comfy 函数 export + NAI import；novelai 模式隐藏 | 进行中 |
| **Phase 2** | `drawProvider=comfyui` 时复用同一面板（只显 comfy view）；comfy-draw.html 退化为兼容入口 | 未开始 |
| **Phase 3** | 废弃 comfy-draw.html / sd-draw.html，单一面板覆盖全部 provider；SD 视需要并入 | 未开始 |

## 6. 设计约束

- 不改动各 provider 的生成引擎、compiler、出图流程
- 不迁移已有用户数据（各 provider settings 保持原位）
- 共享层（shared/）继续作为跨 provider 数据的唯一通道
- 每个阶段保持向后兼容，旧面板文件在 Phase 3 前保留

## 7. 风险与应对

| 风险 | 应对 |
|---|---|
| 两个宿主 JS 同时操作一个 iframe 的 DOM | view 函数集中在 comfy-draw.js 导出，操作入口唯一 |
| 事件绑定重复（NAI 自写 vs comfy 原有） | 从 comfy-draw.js 抽取 view 事件绑定函数 export，两边共用 |
| 面板体积增大（199KB + 缝入内容） | 按需缝入，Phase 1 只缝工作流 + 绘图参数 |
| 上游 PR 违和 | 以「provider 内部模块化 + 面板渐进统一」为叙述，不引入新目录概念 |
