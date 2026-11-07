export function operationMessage(index, path, field, reason, details = {}) {
    const location = index === undefined ? (field ? `${field}：` : '')
        : `第 ${index + 1} 条操作${typeof path === 'string' ? `（path: ${path}）` : ''}${field ? `的 ${field}` : ''}：`;
    const actual = Object.hasOwn(details, 'actual') ? `提交值 ${JSON.stringify(details.actual)}；` : '';
    const choices = details.allowed ? `；可用值：${details.allowed.join(' / ')}` : '';
    return `${location}${actual}${reason}${choices}`;
}
