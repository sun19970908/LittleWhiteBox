# 小白X 后端

小白X 后端（`littlewhitebox-server`）是一个装在酒馆服务器上的插件。大部分功能不需要它；只有下面这些要用到时才需要安装。

| 功能 | 没装后端时 |
| --- | --- |
| AI 画图的[后台任务](draw.md#后台任务)：关掉页面、刷新、断网时画图照样继续 | 不能开启后台任务，画图在浏览器里进行 |
| NovelAI `发送方式` 选 `后端发送` | 只能用 `前端直连` |
| 图片 `图片按日期分文件夹保存` | 图片照常保存，但只按角色名分文件夹 |
| 图库的 `打开文件夹` | 提示需要安装插件 |
| 联网搜索选 Exa 官方接口 | 无法使用 Exa 官方接口 |

后端只需要装一次，所有功能共用。

## 安装

开始前确认你的酒馆运行在 Node.js 18 或更新版本上。

1. 如果有画图后台任务正在运行，先等它完成、结果保存好，然后关闭酒馆。
2. 打开酒馆目录下的 `plugins` 文件夹（`SillyTavern/plugins/`，没有就新建）。如果里面有下面两个旧文件夹，删掉它们；没有就跳过：

   ```text
   littlewhitebox-image-jobs
   littlewhitebox-nai
   ```

3. 找到小白X 扩展里的后端文件夹：

   ```text
   SillyTavern/public/scripts/extensions/third-party/LittleWhiteBox/server-plugin/littlewhitebox-server/
   ```

   如果小白X 装在你的用户数据目录（`SillyTavern/data/<用户名>/extensions/`）下，就到那里的小白X 文件夹里找 `server-plugin/littlewhitebox-server/`。

4. 把 `littlewhitebox-server` **整个文件夹**复制到 `SillyTavern/plugins/` 里，提示有同名文件时选“全部替换”。复制好后应该是：

   ```text
   SillyTavern/plugins/littlewhitebox-server/
   ```

5. 用文本编辑器打开 `SillyTavern/config.yaml`，把 `enableServerPlugins` 改成下面这样（没有就新增一行）：

   ```text
   enableServerPlugins: true
   ```

6. 重新启动酒馆（关掉命令行窗口或容器再启动，不是在浏览器里按 F5），然后刷新页面。

画图面板里也有这份步骤：在 `API 配置` 开启后台任务后会出现 `安装指引` 按钮，点开就能看到。

## 确认装好了

**看启动日志**

酒馆启动时，命令行里应该有类似这样的内容：

```text
Initializing plugin from .../plugins/littlewhitebox-server/...
1 server plugin(s) are currently loaded. ...
```

一行 `server plugin(s)` 都没有，说明 `enableServerPlugins` 没有生效。

**看画图面板**

用 NovelAI 时，打开画图设置的 `API 配置`，`发送方式` 选 `后端发送`，下面会显示后端状态：

| 显示 | 意思 |
| --- | --- |
| `littlewhitebox-server 已就绪（v…）` | 装好了 |
| `未检测到 littlewhitebox-server，请安装或启用后重启酒馆` | 没装上，或 `enableServerPlugins` 没开 |
| `littlewhitebox-server 版本过旧（当前 v…，需要 v…+）` | 需要[升级](#升级) |
| `littlewhitebox-server 缺少后台绘图能力（当前 v…），请完整更新插件并重启酒馆` | 后端太旧，不支持后台任务，需要升级 |
| `无法连接 littlewhitebox-server，请检查酒馆连接及 enableServerPlugins 设置` | 连不上酒馆后端，或插件没启用 |

改好后点 `重新检测` 刷新状态。

用 SD WebUI 或 ComfyUI 时，直接勾选 `使用小白X后台任务（场景分析 + 批量出图）` 配一次图；后端有问题时会提示原因，见[常见错误](#常见错误)。

## 升级

一般情况下，**画图功能随小白X 扩展一起更新**，更新扩展就行，不用再复制后端、也不用重启酒馆。

以下情况需要重新复制一次后端：

- 画图时提示“请完成这一次后台升级，以后绘图功能随扩展更新。”
- 状态显示版本过旧或缺少后台绘图能力。
- 想用 `图片按日期分文件夹保存`、`打开文件夹` 这类新功能，但仍提示需要安装插件。这些功能要新版后端才有，只更新扩展不够。

升级步骤和[安装](#安装)完全一样：等任务完成 → 关闭酒馆 → 用扩展里的 `littlewhitebox-server` 整个文件夹覆盖 `SillyTavern/plugins/littlewhitebox-server/`（同名文件全部替换）→ 重启酒馆 → 刷新页面。

注意：

- 重启前一定先等画图后台任务完成。后台任务只在酒馆运行时存在，重启后不会接着跑。
- 从旧后端 `littlewhitebox-image-jobs` 升级时，必须删掉旧文件夹再放新的。只把旧文件夹改名，或者只更新扩展，都不行。新旧后端不要同时放在 `plugins` 里。
- 升级不会动你的聊天、图片和设置。

## 常见错误

**画图提示“后台画图服务不可用”“小白X后台任务不可用”或“绘图后端插件未安装”**

后端没装上或没启用。按[安装](#安装)检查：文件夹位置对不对、`enableServerPlugins: true` 有没有写对、改完有没有重启酒馆。暂时不想装的话，关掉 `使用小白X后台任务`，画图会改在浏览器里进行。

**提示“后端代发失败”或“后端端点不存在”**

NovelAI 用 `后端发送` 但后端没装好。安装后端，或把 `发送方式` 改回 `前端直连`。

**改了 config.yaml 还是检测不到**

- 确认改的是酒馆根目录的 `config.yaml`，不是 `default` 文件夹里的那份。
- 确认那一行是 `enableServerPlugins: true`，冒号后有空格，前面没有 `#`。
- 确认重启的是酒馆本身（命令行窗口、进程或容器），不是只刷新浏览器。

**启动日志出现 `plugin ID 'littlewhitebox-server' is already in use`**

`plugins` 里放了两份后端，例如复制成了 `littlewhitebox-server (1)` 或另起了名字。只保留 `littlewhitebox-server` 一份。

**启动日志出现 `Failed to load plugin` 一类的错误**

文件没复制全，或 Node.js 版本太低。删掉 `plugins/littlewhitebox-server/`，从扩展里重新完整复制一次，并确认 Node.js 是 18 或更新版本。

**启动日志出现 `Git is not installed. Please install Git to enable auto-updating of server plugins.`**

这是酒馆自己在尝试自动更新服务器插件，和小白X 后端能否使用无关。小白X 后端按上面的[升级](#升级)方式手动更新。

**“打开文件夹”提示“酒馆不在本机，无法直接打开”**

这个按钮只能在运行酒馆的那台电脑上用。从手机、别的电脑访问，或者酒馆前面套了反向代理时，都打不开，请直接到酒馆服务器上找图片文件夹。

**“打开文件夹”提示“系统没能打开文件夹”**

酒馆所在的系统没有可用的文件管理器（例如没有桌面的 Linux 服务器）。请直接到服务器上找图片文件夹。

**重启酒馆后，画到一半的图没了**

后台任务在酒馆重启后不会继续。在图片卡片上点 `重新生成` 即可。
