import type { MaintenanceStatus } from '../../../capabilities/maintenance/runner.js';
import type { MapClientState } from '../types.js';
import { providerFailureMessage } from '../../../capabilities/agent/provider-failure.js';

// Only closed, application-owned categories cross into the UI; never provider errors or credentials.
function failureReason(reason: string): string {
    const providerMessage = providerFailureMessage(reason);
    if (providerMessage) { return providerMessage; }
    switch (reason) {
        case 'agent-not-configured': return '请先在 API 应用中配置模型和所需的密钥。';
        case 'config-load-failed': return '未能读取模型配置，请打开 API 应用检查后重试。';
        case 'agent-session-failed': return '模型连接未能建立，请检查 API 配置后重试。';
        case 'empty-provider-response': return '模型返回了空内容，请稍后重试，或在 API 应用中更换模型。';
        case 'tool-errors-unresolved': return '模型提交的地图修改未通过检查，请重试；反复出现时可更换模型。';
        case 'round-limit': return '模型在本次处理上限内未完成绘制，可以稍后继续更新。';
        case 'background-capture-failed': return '未能读取角色或世界背景，请确认聊天已加载后重试。';
        case 'session-creation-failed': return '未能准备地图数据，请重新打开地图后重试。';
        case 'session-result-failed': return '未能整理本次地图结果，请稍后重试。';
        case 'save-unconfirmed': return '保存结果尚未确认，请先核实保存结果，不要重复更新。';
        case 'save-failed': return '未能保存地图，请检查存储连接后重试。';
        default: return '未取得具体失败原因，可稍后重试；若持续失败，请查看浏览器控制台日志。';
    }
}

export function skippedMaintenanceMessage(reason: string): string {
    switch (reason) {
        case 'generation-active': return '当前正在生成回复，暂时不能更新地图。';
        case 'no-complete-assistant': return '还没有完整的角色回复，请完成一轮对话后再更新地图。';
        case 'no-usable-messages': return '当前没有可用于更新地图的对话内容。';
        case 'chat-unavailable': return '请先打开一个聊天，再更新地图。';
        case 'participant-disabled': return '地图更新当前不可用，请重新打开 OS 后重试。';
        case 'no-work': return '当前没有需要更新的地图内容。';
        default: return '未能开始地图更新，请确认聊天已加载后重试。';
    }
}

export function maintenanceState(status: MaintenanceStatus): Pick<MapClientState, 'maintenanceStatus' | 'maintenanceMessage'> {
    if (status.state === 'running') {
        return { maintenanceStatus: status.mode === 'rebuild' ? 'rebuilding' : 'maintaining', maintenanceMessage: '' };
    }
    let maintenanceMessage = '';
    if (status.message === 'updated') {
        maintenanceMessage = status.mode === 'rebuild' ? '地图已建立并保存。' : '地图已更新。';
    } else if (status.message === 'unchanged') {
        maintenanceMessage = status.mode === 'rebuild' ? '这次没有绘制出地图，可以补充世界设定后重试。' : '地图无需更新。';
    } else if (status.message === 'partial') {
        maintenanceMessage = `部分地图已保存，但本次更新未能全部完成。${failureReason(status.reason)}`;
    } else if (status.message === 'cancelled') {
        maintenanceMessage = '本次地图更新已取消。';
    } else if (status.message === 'skipped') {
        maintenanceMessage = skippedMaintenanceMessage(status.reason);
    } else if (status.state === 'error' || status.message === 'failed') {
        maintenanceMessage = `地图更新未完成。${failureReason(status.reason)}`;
    }
    return {
        maintenanceStatus: status.state === 'error' || status.message === 'failed' ? 'error' : 'idle',
        maintenanceMessage,
    };
}
