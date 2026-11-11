import { CONTEXT_COPY } from '../shared/context-copy.js';
import { UPDATE_RULES_PREFIX } from './world-info.js';
import { UPDATE_BUTTONS } from '../shared/update-buttons.js';

const ACTIONS = Object.freeze({ ...UPDATE_BUTTONS, details: UPDATE_BUTTONS.result, saveChat: UPDATE_BUTTONS.retrySave, preview: UPDATE_BUTTONS.previewRequest });

export const COPY = Object.freeze({
    ...ACTIONS,
    title: '变量 2.0', resultTitle: '变量更新结果',
    close: '关闭', source: '更新模型', pluginUpdate: '插件更新', auto: '回复后自动更新',
    sources: { main: '小白助手 · 主助手 API', delegate: '小白助手 · 分身 API' },
    noChat: '请先进入角色卡', noReply: '请先生成一条 AI 回复',
    enable: '请在变量控制中启用变量管理，并选择 2.0',
    unavailable: '请先启用并配置 Agent API',
    ...CONTEXT_COPY,
    help: [
        ['插件更新', `回复完成后，插件另请一个模型读这段回复并更新变量。不勾选自动时，点 AI 回复下方的「${ACTIONS.update}」。模型的 API 在「扩展程序 → 小白X → 数据互动 → 小白助手」的齿轮中配置。`],
        ['正文顺带更新', '有的卡让写正文的 AI 在回复末尾写 <state>，变量随回复一起更新。这样的楼层插件不会再更新一遍。'],
    ],
    authorTitle: '做卡',
    authorHelp: [
        ['制作变量卡', `在角色任务中写结构、约束和初值并启用循环任务。世界书分成两个条目：当前值宏与字段含义正常启用，蓝灯、角色后，排序可用 999；更新规则标题以「${UPDATE_RULES_PREFIX}」开头，关闭条目，蓝灯、D0。插件更新只在本次请求中读取这个关闭条目，不修改原件。`],
        ['从正文顺带更新改成插件更新', '当前值宏与字段含义留在启用的条目里，更新要求和提交说明移到上面的关闭条目，再删掉要求 AI 在正文里写 <state> 的指令。'],
        ['插件更新会读到什么', `和正文生成一样由酒馆组装上下文：世界书触发、隐藏楼层、其他插件注入、排序和裁剪都照常生效，不替换你的写作预设。只更新最新一条 AI 回复，不改写正文。点「${ACTIONS.preview}」可以看到实际发出的内容。`],
    ],
    invalid: '模型没有返回一次完整的 write 变量提交，本次提交未应用', stale: '聊天、回复或变量已变化，本次结果未应用',
    noVariables: '这段聊天还没有受管变量，请先初始化变量卡',
    phases: { ready: '尚未更新', recorded: '已有变量记录', body: '正文已更新变量', preparing: '读取资料…', requesting: '更新中…', correcting: '正在重试…', saving: '保存中…', success: '已更新', noop: '无需修改', failed: '更新失败', cancelled: '已取消' },
    result: { added: '新增', removed: '删除', unchanged: '无变量变化', annotations: 'AI 附带说明', corrected: '执行时调整', requested: '提交值', applied: '实际值' },
    settingsInvalid: '变量更新设置无效',
    failedSave: '变量状态保存失败，请重试保存，不要重复更新',
    saveUnconfirmed: '未能确认这次变量更新已保存到酒馆', initialValue: '初始值',
});
