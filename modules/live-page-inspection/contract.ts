export const PAGE_CHARS = 12000;
export const LOG_BUDGET_CHARS = 262144;
export const LOG_LIMIT = 500;
export const COLLECTOR_KEY = '__lwbInspectPageStart';

export const ACTIONS = ['list', 'inspect', 'find', 'dom', 'styles', 'errors'] as const;
export type Action = typeof ACTIONS[number];
export interface InspectArgs {
    action?: Action;
    frameId?: string;
    elementId?: string;
    text?: string;
    selector?: string;
    includeHidden?: boolean;
    properties?: string[];
    pseudo?: string;
    offset?: number;
    documentId?: string;
}

export const COPY = {
    label: '检查活页面',
    result: '已读取页面',
    continued: '后面还有内容，可以继续读取。',
    errors: {
        no_frame: '聊天里没有仍在运行的 iframe。',
        stale_frame: '这个页面已关闭或被替换，请重新列出页面。',
        inaccessible: '浏览器不允许读取这个 iframe 的文档，通常因为页面跨域或沙箱限制。可以读取外层页面信息，不能读取内部 DOM 和报错。',
        stale_document: '这个 iframe 已加载另一份文档，请从头读取。',
        stale_element: '这个元素已离开当前页面，请重新查找。',
        not_found: '没有找到匹配的元素。',
        ambiguous: '匹配到了多个元素。请用 find 查看结果，再传 elementId。',
        invalid_args: '检查参数无效。',
    },
} as const;

export class InspectionError extends Error {
    constructor(public code: keyof typeof COPY.errors) { super(COPY.errors[code]); }
}
