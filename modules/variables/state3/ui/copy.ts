import { diagnostic } from '../engine/diagnostics.js';
import { UPDATE_BUTTONS } from '../../shared/update-buttons.js';
import type { Condition, ConditionValue, Diagnostic, Json, ParameterIssue, Path, Success } from '../types.js';
export const COPY = {
    ...UPDATE_BUTTONS,
    title: '变量 3.0', author: '制作规则', play: '当前聊天', close: '关闭',
    authorHelp: [
        '3.0 是一个结算引擎：直接改值、动作、关联计算、规则修正和条件触发，在一次结算里按顺序算完并整体检查，全部通过才生效，任何一步不通过就整批不生效。掷骰、战斗回合这类复杂玩法可以写成函数。更新模型和卡片面板上的按钮用的都是这同一套规则。',
        `从一个想法开始就行：点「${UPDATE_BUTTONS.assistant}」，说你想怎么玩，助手会写设定、世界书、规则和面板。规则保存在角色卡里，随卡分享。也可以在下面直接编辑：definition.json 是规则本体，functions 里放规则引用的函数。`,
        '编辑后点「检查规则」，看开局变量和问题；「保存草稿」只保存编辑内容；「存入角色卡」后，新聊天会用这套规则开局，已有聊天在「当前聊天」页启用。',
    ],
    file: '文件', playHelp: '当前值在变量面板查看，各楼的变化在「查看结果」中查看和撤销。',
    draft: '规则草稿', saveDraft: '保存草稿', savedDraft: '草稿已保存', check: '检查规则',
    checkTitle: '检查规则', checkPassed: '规则可以使用。开局变量：', checkFailed: '规则还不能使用：',
    saveCard: '存入角色卡', savedCard: '规则已保存到角色卡',
    enable: '启用规则',
    importRules: '导入规则', exportRules: '导出规则',
    importConfirm: '将完整替换当前角色卡的规则和函数。聊天变量、回滚记录及未保存的草稿不变。继续吗？',
    importedRules: '卡上规则已替换，之后的更新直接使用新规则。已有草稿已保留。', exportedRules: '规则已导出',
    notEnabled: '此聊天还没有启用 3.0 规则。卡上有规则时，点下面的按钮按规则开局；还没有规则，请先到「制作规则」。',
    details: '详细信息', parameterName: '参数',
    parameterTypes: { string: '文字', number: '数字', integer: '整数', boolean: '是或否', array: '列表', object: '对象', null: '空值' } as Record<string, string>,
    parameterErrors: {
        maximum: (name: string, p: Record<string, unknown>) => `${name}最多 ${p.limit}`,
        minimum: (name: string, p: Record<string, unknown>) => `${name}最少 ${p.limit}`,
        exclusiveMaximum: (name: string, p: Record<string, unknown>) => `${name}必须小于 ${p.limit}`,
        exclusiveMinimum: (name: string, p: Record<string, unknown>) => `${name}必须大于 ${p.limit}`,
        required: (name: string) => `请填写${name}`,
        type: (name: string, p: Record<string, unknown>) => `${name}需要填写${String(p.type).split(',').map(type => COPY.parameterTypes[type] || type).join('或')}`,
        enum: (name: string, p: Record<string, unknown>) => `${name}请选择：${(p.allowedValues as unknown[]).map(displayValue).join('、')}`,
        const: (name: string, p: Record<string, unknown>) => `${name}必须为 ${displayValue(p.allowedValue)}`,
        minLength: (name: string, p: Record<string, unknown>) => `${name}至少 ${p.limit} 个字符`,
        maxLength: (name: string, p: Record<string, unknown>) => `${name}最多 ${p.limit} 个字符`,
        minItems: (name: string, p: Record<string, unknown>) => `${name}至少 ${p.limit} 项`,
        maxItems: (name: string, p: Record<string, unknown>) => `${name}最多 ${p.limit} 项`,
        pattern: (name: string) => `${name}格式不符，请按输入框下方的说明填写`,
        format: (name: string, p: Record<string, unknown>) => `${name}格式不符（${p.format}）`,
        additionalProperties: (name: string) => `不需要填写${name}`,
        multipleOf: (name: string, p: Record<string, unknown>) => `${name}必须是 ${p.multipleOf} 的倍数`,
        uniqueItems: (name: string) => `${name}中不能有重复项`,
    } as Record<string, (name: string, params: Record<string, unknown>) => string>,
    parameterInvalid: (name: string) => `${name}不符合要求，请检查详细信息`,
    conditionFailed: (text: string) => `条件不成立：${text}`,
    conditionCompare: (left: string, symbol: string, right: string) => `${left}，需要 ${symbol} ${right}`,
    conditionAny: (items: string[]) => `以下条件至少满足一项：${items.join('；')}`,
    conditionFunction: (name: string, expected: boolean) => expected ? `函数 ${name} 判定不成立` : `函数 ${name} 判定成立，需要不成立`,
    conditionBefore: (name: string) => `本次操作前的${name}`,
    computedValue: '计算结果', trueValue: '是', falseValue: '否',
    comparisonSymbols: { eq: '=', ne: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥' },
    sourceGroup: (name: string, count: number) => `${name} · ${count} 项`,
    restoredChanges: '恢复的变化',
    pluginUpdate: '更新方式', auto: '回复后自动更新', model: '更新模型',
    updateModes: { before: '回复前更新', after: '回复后更新', both: '回复前＋回复后更新' },
    beforeAuto: '回复前由卡的规则自动执行。',
    afterHelp: '回复后不勾自动时，点 AI 回复下方的「更新变量」。',
    pluginUpdateHelp: '前后阶段分别请求更新模型，产生各自的 API 费用。模型 API 在小白助手的齿轮中配置。',
    stageNames: { before: '回复前', after: '回复后' },
    beforeOutcomes: { applied: '已结算', rejected: '行动未成立', failed: '结算失败', skipped: '已跳过结算', undone: '已撤销结算' },
    beforeEdited: '这条消息改过了，仍保留原结算。要按新内容计算，请点「重新结算」。',
    messageEdited: '消息已修改', retryCalculation: '重试结算',
    hostSave: '结果已生效，随酒馆聊天保存。',
    beforeFailure: '回复前结算失败，正文尚未生成。可以重试，或跳过这次结算。',
    settleBefore: '结算', unsettled: '未结算', recompute: '重新结算', retryBefore: '重试', skipBefore: '跳过结算',
    sources: { main: '小白助手 · 主助手 API', delegate: '小白助手 · 分身 API' },
    undoReply: '撤销结算',
    added: '新增', removed: '删除', annotation: '提交说明',
    previewTitle: '试算结果', empty: '变量没有变化', success: '结算成功', previewLabel: '已试算', previewed: '执行后变量会这样变化：',
    noResult: '还没有结算结果', floorResult: (index: number) => `第 ${index + 1} 楼`,
    failed: '本次未生效', saved: '已保存', unconfirmed: '结果已生效，但未确认保存。请重试保存，不要重复执行动作。',
    restored: '已恢复变量', restoredConflict: '已恢复，但有规则冲突', restoredUnchecked: '已恢复，但规则检查失败',
    conflictHelp: '请切回原回复，或在后续剧情中解决这个冲突，否则变量更新会继续报错。',
    constraintConflict: (description: string) => `当前状态违反作者规则：“${description}”。`,
    schemaConflict: '当前状态不符合作者定义的字段格式。',
    ruleCheckFailed: (rule?: string) => `无法检查${rule ? `作者规则：“${rule}”` : '卡上的规则'}。变量已恢复，请检查规则定义。`,
    currentFields: (fields: string[]) => `当前：${fields.join('；')}。`,
    missingValue: '不存在',
    refreshing: '正在读取…', newFunction: '新建函数', functionName: '函数名（字母、数字、下划线或短横线）',
    phases: { ready: '', preparing: '正在读取资料', requesting: '正在更新', calculating: '正在结算', correcting: '正在重试', saving: '正在保存', success: '已更新', unsaved: '尚未保存', failed: '更新失败', cancelled: '已取消' } as Record<string, string>,
    reasons: { input: '直接修改', action: '动作', derive: '关联计算', correct: '规则修正', trigger: '状态触发' },
    errors: {
        'stage-missing': '前后都更新的卡，需要给每个动作和可直接修改的字段指定阶段。',
        'stage-unknown': '动作或字段使用了这张卡未启用的更新阶段。',
        'stage-disabled': '这张卡没有启用这个更新阶段。',
        'stage-permission': '这个动作或字段不属于本次更新阶段。',
        'not-enabled': '当前聊天尚未启用规则。', 'already-enabled': '当前聊天已启用 3.0。',
        'definition-missing': '这张卡还没有 3.0 规则。', 'definition-shape': '规则包格式不完整。', 'definition-schema': '规则定义的结构不正确。',
        'unowned-root': '只能修改此聊天初始化过的变量及其子字段。',
        'rules-conflict': '卡上规则已被修改，请重新选择导入文件。',
        'history-format': '变量回滚记录格式不正确。',
        'trigger-cycle': '触发规则无法收敛，本次没有生效。',
        'notification-failed': '结果已生效，但通知其他功能时出错。',
        'input-shape': '提交格式不正确，请按卡提供的字段或动作提交。',
        'input-number': '增量必须是有限数字，不能填写文字或空值。',
        'increment-target': '只能对已经存在的数字加减，请先初始化该字段。',
        'increment-overflow': '加减后的数值过大，无法保存。',
        'path': '路径需要由字段名组成的数组。', 'json': '提交中有不能保存的值。',
        'missing-parent': '要写入的父对象不存在，请先创建它。', 'array-index': '数组位置不合法。',
        'function_exception': '自定义函数执行失败。', 'target-missing': '找不到要更新的回复。',
        'nothing-to-save': '没有等待重试保存的结果。',
        'state-schema': '结算后的状态不符合定义。', 'constraint': '结算未通过规则检查。',
        'action-precondition': '动作的前提不成立。', 'action-parameters': '动作参数不符合要求。', 'action-missing': '找不到这个动作。',
        'permission': '此字段不允许通过当前方式修改。', 'derived-write': '此字段由规则计算，不能直接修改。',
        'stale-target': '聊天、回复、变量或卡上规则已变化，请重新更新。', 'cancelled': '已取消，状态未改变。',
        'save-unconfirmed': '无法确认聊天已经保存。', 'draft-conflict': '草稿已被其他编辑修改，请重新打开后合并。',
        'dependency-cycle': '规则存在循环依赖。',
        'rule-write-conflict': '多条关联规则同时负责同一字段。', 'correction-unstable': '修正规则不能得到稳定结果。',
        'function-missing': '缺少规则引用的函数。', 'function-undeclared': '函数没有在定义中声明。',
        'function_work_limit': '函数计算量超过上限，本次未生效，请检查函数是否会结束。', 'function_aborted': '函数计算已取消。',
        'function_startup_failed': '计算环境未能启动，可以重试结算。',
        'function_worker_error': '计算环境发生错误，可以重试结算。',
        'function_worker_unresponsive': '计算环境未响应，可以重试结算。',
        'function_message_error': '计算结果传递失败，可以重试结算。',
        'function_worker_unavailable': '此环境不支持独立计算线程。',
        'function_busy': '计算正在进行，请稍后再试。',
        'trigger-limit': '连续触发次数达到上限，本次未生效，请检查触发规则。',
        'nothing-to-undo': '此回复没有可撤销的提交。', 'chat-missing': '请先进入角色卡。', 'character-missing': '请先进入角色卡。',
        'commit-busy': '正在处理上一笔结果，请稍候。', 'stage-consumed': '这次结果已经提交，请重新试算。',
        'agent-unavailable': '请先启用并配置小白助手的 Agent API。', 'model-submission': '模型没有提交一次完整的变量修改，本次未生效。',
        'async-schema': '结构校验应是同步规则；领域自定义计算请使用规则函数。',
    },
};
function displayValue(value: unknown): string {
    if (value === undefined) {return COPY.missingValue;}
    if (value === true) {return COPY.trueValue;}
    if (value === false) {return COPY.falseValue;}
    return typeof value === 'string' ? `“${value}”` : JSON.stringify(value);
}
export function parameterIssueText(issue: ParameterIssue): string {
    const name = issue.name || COPY.parameterName;
    return COPY.parameterErrors[issue.keyword]?.(name, issue.params) || COPY.parameterInvalid(name);
}
function conditionValueText(operand: ConditionValue): string {
    const name = operand.before ? COPY.conditionBefore(operand.name || COPY.computedValue) : operand.name;
    return [name, displayValue(operand.value)].filter(Boolean).join(' ');
}
export function conditionText(condition: Condition): string {
    switch (condition.kind) {
        case 'any': return COPY.conditionAny(condition.conditions.map(conditionText));
        case 'function': return [COPY.conditionFunction(condition.id, condition.expected), condition.description].filter(Boolean).join(' · ');
        case 'comparison': return COPY.conditionCompare(conditionValueText(condition.left), COPY.comparisonSymbols[condition.operator], conditionValueText(condition.right));
        case 'value': return COPY.conditionCompare(conditionValueText(condition.operand), '=', displayValue(condition.expected));
    }
}
export function restorationLabel(result: Success): string {
    if (!result.restoration?.length) {return COPY.restored;}
    return result.restoration.some(issue => ['constraint', 'state-schema'].includes(issue.code)) ? COPY.restoredConflict : COPY.restoredUnchecked;
}
export function restorationText(issue: Diagnostic): string {
    if (['constraint', 'state-schema'].includes(issue.code)) {
        const fields = issue.fields as { path: Path; value?: Json }[] | undefined;
        return (issue.code === 'constraint' ? COPY.constraintConflict(String(issue.description || issue.rule)) : COPY.schemaConflict) + (fields?.length
            ? COPY.currentFields(fields.map(field => `${field.path.join(' → ')}为${field.value === undefined ? COPY.missingValue : typeof field.value === 'string' ? `“${field.value}”` : JSON.stringify(field.value)}`)) : '');
    }
    return COPY.ruleCheckFailed(issue.description ? String(issue.description) : issue.rule);
}
export function errorText(error: unknown): string {
    const detail = error && typeof error === 'object' && 'code' in error ? error as Diagnostic : diagnostic(error);
    if (detail.code === 'action-precondition' && detail.condition) {
        return [detail.actionTitle || detail.action || detail.rule, COPY.conditionFailed(conditionText(detail.condition))].filter(Boolean).join(' · ');
    }
    if (detail.code === 'action-parameters' && detail.parameters?.length) {
        return [detail.actionTitle || detail.action || detail.rule, detail.parameters.map(parameterIssueText).join('；')].filter(Boolean).join(' · ');
    }
    const label = (COPY.errors as Record<string, string>)[detail.code] || detail.message || detail.code || COPY.failed;
    return [typeof detail.operation === 'number' ? '第 ' + (detail.operation + 1) + ' 条操作' : '', Array.isArray(detail.path) ? detail.path.join(' → ') : '', detail.rule,
        Array.isArray(detail.rules) ? detail.rules.join(' → ') : '', detail.functionId, label].filter(Boolean).join(' · ');
}
