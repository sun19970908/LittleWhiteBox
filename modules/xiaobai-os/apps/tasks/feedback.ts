import { providerFailureMessage } from '../../capabilities/agent/provider-failure.js';
import type { MaintenanceStatus } from '../../capabilities/maintenance/runner.js';

export function taskFailureMessage(reason: string): string {
    const providerMessage = providerFailureMessage(reason);
    if (providerMessage) { return providerMessage; }
    switch (reason) {
        case 'agent-not-configured': return '请先在 API 应用中配置模型和所需的密钥。';
        case 'config-load-failed': return '未能读取模型配置，请在 API 应用中检查后重试。';
        case 'agent-session-failed': return '模型连接未能建立，请检查 API 配置后重试。';
        case 'empty-provider-response': return '模型没有返回内容，请重试；反复出现时可更换模型。';
        case 'invalid-response':
        case 'tool-errors-unresolved': return '模型返回的任务内容未通过检查，请重试；反复出现时可更换模型。';
        case 'response-truncated': return '模型回复不完整，请检查输出长度限制后重试。';
        case 'round-limit': return '本次处理达到上限，未能全部完成，可以稍后继续更新。';
        case 'background-capture-failed': return '未能读取剧情与世界背景，请确认聊天已加载后重试。';
        case 'session-creation-failed':
        case 'session-result-failed': return '未能整理任务数据，请重新读取后再试。';
        case 'save-unconfirmed': return '保存结果尚未确认，请先核实保存，不要重复生成。';
        case 'save-conflict': return '保存版本不一致，请先采用服务端数据，不要重复生成。';
        case 'save-failed': return '保存未完成，原有任务保留。请先检查存储连接，再重试。';
        default: return '操作未完成，请重试；持续失败时可查看控制台诊断。';
    }
}

export function taskMaintenanceMessage(status: MaintenanceStatus, saveRecovered: boolean): string {
    if (status.state === 'running') { return ''; }
    if (saveRecovered && status.reason === 'save-unconfirmed') { return '保存状态已核实，当前显示已确认的任务。'; }
    switch (status.message) {
        case 'updated': return '任务已更新。';
        case 'unchanged': return '已检查，当前任务无需更新。';
        case 'partial': return '部分任务状态已保存，但本次更新未能全部完成。' + taskFailureMessage(status.reason);
        case 'failed': return '任务更新失败。' + taskFailureMessage(status.reason);
        case 'cancelled': return '本次任务更新已取消。';
        case 'skipped':
            switch (status.reason) {
                case 'no-work': return '当前没有需要更新的任务进展。';
                case 'no-complete-assistant':
                case 'no-usable-messages': return '还没有可用于检查任务进展的剧情，请完成一轮对话后再更新。';
                case 'generation-active': return '角色正在回复，等这次对话结束后再更新任务。';
                case 'chat-unavailable': return '请先进入聊天，再更新任务。';
                case 'participant-disabled': return '任务更新当前不可用，请重新打开 OS 后重试。';
                default: return '本次未能开始检查任务进展，请稍后重试。';
            }
        default: return '';
    }
}
