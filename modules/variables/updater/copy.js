import { CONTEXT_COPY } from '../shared/context-copy.js';
import { UPDATE_RULES_PREFIX } from './world-info.js';

const ACTIONS = Object.freeze({ update: '更新变量', details: '查看结果', assistant: '让小白助手制作', saveChat: '重试保存', preview: '查看当前上下文' });

export const COPY = Object.freeze({
    ...ACTIONS,
    title: '变量更新', retry: '重新更新', cancel: '取消',
    close: '关闭', save: '保存设置', saved: '设置已保存', source: '更新模型', mode: '更新方式',
    modes: { off: '关闭', manual: '手动更新', auto: '回复后自动更新' },
    sources: { main: '小白助手 · 主助手 API', delegate: '小白助手 · 分身 API' },
    noChat: '请先打开聊天', noReply: '请先生成一条 AI 回复',
    enable: '请在变量控制中启用变量管理，并选择 2.0',
    unavailable: '请先启用并配置 Agent API',
    ...CONTEXT_COPY,
    help: {
        title: '怎么用',
        steps: [
            ['配置模型', '这是独立模型的变量更新设置。在「变量控制」启用变量管理 2.0；API 在「扩展程序 → 小白X → 数据互动 → 小白助手」的齿轮中配置，上面的两个选项分别对应「主助手 API」和「分身 API」。'],
            ['使用成品卡', `作者做好初始化和世界书后，玩家不用重写。打开聊天，在变量面板确认已有数据，选好更新方式和模型并保存。手动时点最新 AI 回复下方的「${ACTIONS.update}」；自动时在回复后更新。`],
            ['制作变量卡', `在角色任务中写结构、约束和初值并启用循环任务。世界书分成两个条目：当前值宏与字段含义正常启用，蓝灯、角色后，排序可用 999；更新规则标题以「${UPDATE_RULES_PREFIX}」开头，关闭条目，蓝灯、D0。更新器只在本次组装中读取专用关闭条目，不修改原件；可用「${ACTIONS.preview}」核对。`],
            [ACTIONS.assistant, '打开当前卡的文件工作区，并填好一条制作请求。你发送后，助手才能检查和修改初始化任务、世界书；保存任务不会执行初始化。'],
            ['已有同步更新', '本楼正文的 <state> 已被变量 2.0 处理时，自动更新会跳过。改用独立更新时，保留启用条目中的当前值与字段含义，把更新要求和提交说明移到专用关闭条目，并取消原来要求剧情模型提交变量的格式指令。继续用正文提交的卡不需要这样改。'],
            ['它会读取什么', '每次请酒馆重新组装上下文，沿用世界书触发、隐藏、插件注入、排序和裁剪，不用另选世界书。使用独立的变量更新流程，不替换你的写作预设；只结算标记的最新 AI 正文，不改写正文。'],
            ['看结果', `在同一楼点「${ACTIONS.details}」看实际变化，数组和对象只展开变动部分。AI 附带说明仅当前这次更新可见，不写入聊天；重开或切换后，变化由操作记录重新计算。模型填错提交时会带着错误自动修正一次；仍失败会显示原因。若提示保存失败，点「${ACTIONS.saveChat}」，不用重新更新。`],
        ],
    },
    invalid: '模型没有返回一次完整的 write 变量提交，本次提交未应用', stale: '聊天、回复或变量已变化，本次结果未应用',
    noVariables: '这段聊天还没有受管变量，请先初始化变量卡',
    phases: { ready: '尚未更新', recorded: '已有变量记录', body: '正文已更新变量', preparing: '读取资料…', requesting: '更新中…', correcting: '正在重试…', saving: '保存中…', success: '已更新', noop: '无需修改', failed: '更新失败', cancelled: '已取消' },
    result: { added: '新增', removed: '删除', unchanged: '无变量变化', annotations: 'AI 附带说明', corrected: '执行时调整', requested: '提交值', applied: '实际值' },
    settingsInvalid: '变量更新设置无效',
    failedSave: '变量状态保存失败，请重试保存，不要重复更新',
    saveUnconfirmed: '未能确认这次变量更新已保存到酒馆', initialValue: '初始值',
});
