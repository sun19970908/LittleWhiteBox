// modules\draw\providers\shared\comfy-workflow-ui.js
//
// 共享的 ComfyUI 工作流 view UI 模块。
// 抽自 providers/comfyui/comfy-draw.js 中工作流 view 相关的纯 UI 函数。
//
// 设计原则：
//   - 不写全局、不依赖固定 document/window — 全部通过 init() 注入
//   - 数据层读写（settings、fetchComfyModels）由调用方通过 adapter 传入
//   - 跨 provider 复用：NAI / ComfyUI 都可调用本模块，传入各自的 adapter
//
// 依赖（由 init() 注入）：
//   - document              iframe 的 contentDocument
//   - getValue(id)          读表单字段
//   - setValue(id, val)     写表单字段
//   - getSettingsElement(id) 拿 iframe 内的 DOM 元素
//   - getSettings()         返回当前 settings 对象
//   - persistSettings(mutator, okText, opts)  写回 settings
//   - fetchComfyModels / fetchComfySamplers  网络拉取（可选；NAI 不接）
//   - parseComfyApiWorkflowJson / validateComfyWorkflowNodeMap  从 compiler.js 导入
//   - updateStatusText / updateComfyOptionStatus / formatBytes  UI 反馈
//
// 用法：
//   import { initComfyWorkflowUI, BUILTIN_WORKFLOWS } from '../shared/comfy-workflow-ui.js';
//   initComfyWorkflowUI({
//     document: iframe.contentDocument,
//     getValue, setValue, getSettingsElement,
//     getSettings, persistSettings,
//     fetchComfyModels, fetchComfySamplers,
//     parseComfyApiWorkflowJson, validateComfyWorkflowNodeMap,
//     updateStatusText, updateComfyOptionStatus,
//   });

import {
    parseComfyApiWorkflowJson,
    validateComfyWorkflowNodeMap,
} from '../comfyui/compiler.js';

// ──────────────── 内置工作流定义（纯数据） ────────────────

export const BUILTIN_WORKFLOWS = [
    {
        id: 'official-core-checkpoint',
        name: '基础出图',
        family: 'simple',
        summary: '最稳的入门方案：选一个模型文件，直接文生图。',
        description: '适合第一次跑通 ComfyUI。小白X 会把提示词、尺寸、采样参数填进内置工作流，并只返回预览图。',
        recommended: {
            width: 512,
            height: 512,
            steps: 20,
            cfg: 8,
            sampler: 'euler',
            scheduler: 'normal',
        },
        notes: '如果你不确定选什么，就先用这个。',
    },
    {
        id: 'checkpoint-sdxl',
        name: '高清出图',
        family: 'simple',
        summary: '同一套稳定流程，但默认使用 1024 尺寸。',
        description: '适合已经确认模型能正常出图后再使用。画面更大，也更吃显存。',
        recommended: {
            width: 1024,
            height: 1024,
            steps: 20,
            cfg: 7,
            sampler: 'euler',
            scheduler: 'normal',
        },
        notes: '如果报显存不足，切回基础出图或降低尺寸。',
    },
];

// ──────────────── 默认值 / 工厂函数 ────────────────

export function createDefaultWorkflowPreset() {
    return {
        id: 'workflow-default',
        name: '默认工作流',
        json: '',
        nodePositive: '',
        nodeNegative: '',
        nodeWidth: '',
        nodeHeight: '',
        nodeSeed: '',
        nodeSaveImage: '',
    };
}

export function normalizeWorkflowPresets(rawPresets, rawCustomWorkflow = {}) {
    const fallbackPreset = {
        ...createDefaultWorkflowPreset(),
        json: String(rawCustomWorkflow?.json || ''),
        nodePositive: String(rawCustomWorkflow?.nodePositive || ''),
        nodeNegative: String(rawCustomWorkflow?.nodeNegative || ''),
        nodeWidth: String(rawCustomWorkflow?.nodeWidth || ''),
        nodeHeight: String(rawCustomWorkflow?.nodeHeight || ''),
        nodeSeed: String(rawCustomWorkflow?.nodeSeed || ''),
        nodeSaveImage: String(rawCustomWorkflow?.nodeSaveImage || ''),
    };
    const source = Array.isArray(rawPresets) && rawPresets.length ? rawPresets : [fallbackPreset];
    return source.map((preset, index) => ({
        ...createDefaultWorkflowPreset(),
        ...preset,
        id: String(preset?.id || `workflow-${Date.now()}-${index}`),
        name: String(preset?.name || `工作流 ${index + 1}`),
        json: String(preset?.json || ''),
        nodePositive: String(preset?.nodePositive || ''),
        nodeNegative: String(preset?.nodeNegative || ''),
        nodeWidth: String(preset?.nodeWidth || ''),
        nodeHeight: String(preset?.nodeHeight || ''),
        nodeSeed: String(preset?.nodeSeed || ''),
        nodeSaveImage: String(preset?.nodeSaveImage || ''),
    }));
}

export function getActiveWorkflowPreset(settings, createDefault = createDefaultWorkflowPreset) {
    return settings.workflowPresets?.find((p) => p.id === settings.selectedWorkflowPresetId)
        || settings.workflowPresets?.[0]
        || createDefault();
}

// ──────────────── adapter-aware factory ────────────────
// 把 init() 注入的依赖装到闭包内，避免每个函数都重复接收 adapter 参数。

let _deps = null;

function deps() {
    if (!_deps) throw new Error('comfy-workflow-ui: 必须先调用 initComfyWorkflowUI()');
    return _deps;
}

export function initComfyWorkflowUI(adapter) {
    if (!adapter || typeof adapter !== 'object') {
        throw new Error('initComfyWorkflowUI: adapter 必填');
    }
    const required = [
        'document',
        'getValue',
        'setValue',
        'getSettingsElement',
        'getSettings',
        'persistSettings',
        'parseComfyApiWorkflowJson',
        'validateComfyWorkflowNodeMap',
    ];
    for (const key of required) {
        if (adapter[key] === undefined) {
            throw new Error(`initComfyWorkflowUI: adapter 缺少 ${key}`);
        }
    }
    _deps = adapter;
}

// ──────────────── 节点映射 / 校验 ────────────────

export function buildWorkflowNodeMapFromForm() {
    const { getValue } = deps();
    return {
        positive: getValue('comfy-node-positive').trim(),
        negative: getValue('comfy-node-negative').trim(),
        width: getValue('comfy-node-width').trim(),
        height: getValue('comfy-node-height').trim(),
        seed: getValue('comfy-node-seed').trim(),
        saveImage: getValue('comfy-node-save-image').trim(),
    };
}

export function validateWorkflowPresetDraftOrThrow({ json, nodeMap }) {
    const { parseComfyApiWorkflowJson, validateComfyWorkflowNodeMap } = deps();
    if (!nodeMap.positive || !nodeMap.saveImage) {
        throw new Error('请至少填写正向提示词节点和 SaveImage 节点。');
    }
    const workflow = parseComfyApiWorkflowJson(json);
    validateComfyWorkflowNodeMap(workflow, nodeMap);
}

// ──────────────── 内置工作流预览 ────────────────

export function getBuiltinWorkflowDefinition(id) {
    return BUILTIN_WORKFLOWS.find((item) => item.id === id) || BUILTIN_WORKFLOWS[0];
}

export function createBuiltinWorkflowPreview({ model, width, height, steps, cfg, sampler, scheduler, buildSimpleWorkflow }) {
    if (typeof buildSimpleWorkflow !== 'function') {
        throw new Error('createBuiltinWorkflowPreview: 需要注入 buildSimpleWorkflow');
    }
    const workflow = buildSimpleWorkflow({
        model: String(model || '<selected-model>'),
        sampler,
        scheduler,
        steps,
        cfg,
        width,
        height,
        positive: '<positive-prompt>',
        negative: '<negative-prompt>',
        seed: '<random-seed>',
    });
    return JSON.stringify(workflow, null, 2);
}

export function getBuiltinWorkflowPreviewParams(settings = null) {
    const { getValue, getSettings } = deps();
    const current = settings || getSettings();
    const selectedBuiltinId = getValue('comfy-builtin-workflow')
        || current.builtinWorkflowId
        || BUILTIN_WORKFLOWS[0].id;
    const workflow = getBuiltinWorkflowDefinition(selectedBuiltinId);
    const fallback = workflow.recommended || {};
    return {
        model: getValue('comfy-draw-model') || current.selectedModel || '<selected-model>',
        sampler: getValue('comfy-draw-sampler') || current.sampler || fallback.sampler || 'euler',
        scheduler: getValue('comfy-draw-scheduler') || current.scheduler || fallback.scheduler || 'normal',
        steps: Number(getValue('comfy-draw-steps')) || current.steps || fallback.steps || 20,
        cfg: Number(getValue('comfy-draw-cfg')) || current.cfg || fallback.cfg || 7,
        width: Number(getValue('comfy-draw-width')) || current.width || fallback.width || 1024,
        height: Number(getValue('comfy-draw-height')) || current.height || fallback.height || 1024,
    };
}

// ──────────────── select 填充 / 列表渲染 ────────────────

export function fillWorkflowPresetSelect(settings = null) {
    const { getSettingsElement, getSettings } = deps();
    const current = settings || getSettings();
    const select = getSettingsElement('comfy-workflow-preset-select');
    if (!select) return;
    select.textContent = '';
    (current.workflowPresets || []).forEach((preset) => {
        const option = select.ownerDocument.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name || preset.id;
        select.appendChild(option);
    });
    select.value = current.selectedWorkflowPresetId || current.workflowPresets?.[0]?.id || '';
}

export function populateModelSelect(models = []) {
    const { getSettingsElement } = deps();
    const select = getSettingsElement('comfy-draw-model');
    if (!select) return;
    const currentValue = select.value;
    const modelList = Array.isArray(models) ? models.filter(Boolean) : [];
    select.textContent = '';
    if (!modelList.length) {
        const opt = select.ownerDocument.createElement('option');
        opt.value = '';
        opt.textContent = '未找到可直接出图的模型';
        select.appendChild(opt);
    } else {
        modelList.forEach(model => {
            const opt = select.ownerDocument.createElement('option');
            opt.value = model;
            opt.textContent = model;
            select.appendChild(opt);
        });
    }
    if (currentValue && modelList.includes(currentValue)) {
        select.value = currentValue;
    }
}

export function populateBuiltinWorkflowSelect(selectedId) {
    const { getSettingsElement } = deps();
    const select = getSettingsElement('comfy-builtin-workflow');
    if (!select) return;
    select.textContent = '';
    BUILTIN_WORKFLOWS.forEach((item) => {
        const option = select.ownerDocument.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
    select.value = BUILTIN_WORKFLOWS.some((item) => item.id === selectedId)
        ? selectedId
        : BUILTIN_WORKFLOWS[0].id;
}

export function refreshBuiltinWorkflowPanel(settings = null) {
    const { getSettingsElement, setValue, getSettings } = deps();
    const current = settings || getSettings();
    const workflow = getBuiltinWorkflowDefinition(current.builtinWorkflowId);
    populateBuiltinWorkflowSelect(workflow.id);
    const summaryEl = getSettingsElement('comfy-builtin-workflow-summary');
    const descEl = getSettingsElement('comfy-builtin-workflow-desc');
    const notesEl = getSettingsElement('comfy-builtin-workflow-notes');
    if (summaryEl) summaryEl.textContent = workflow.summary;
    if (descEl) descEl.textContent = workflow.description;
    if (notesEl) notesEl.textContent = workflow.notes || '';
    // 内置工作流预览需要 buildSimpleWorkflow，调用方需额外提供 createBuiltinWorkflowPreview 函数
    if (typeof _deps.createBuiltinWorkflowPreview === 'function') {
        const params = getBuiltinWorkflowPreviewParams(current);
        const preview = _deps.createBuiltinWorkflowPreview(params);
        setValue('comfy-builtin-workflow-preview', preview);
    }
}

// ──────────────── 工作流 view 初始化（DOM 事件绑定） ────────────────

export function bindComfyWorkflowUI() {
    const { getSettingsElement, setValue, persistSettings, getSettings } = deps();

    // 工作流 preset 选择
    getSettingsElement('comfy-workflow-preset-select')?.addEventListener('change', async () => {
        const selectedWorkflowPresetId = getSettingsElement('comfy-workflow-preset-select').value;
        const current = getSettings();
        const preset = current.workflowPresets?.find((item) => item.id === selectedWorkflowPresetId)
            || current.workflowPresets?.[0]
            || createDefaultWorkflowPreset();
        setValue('comfy-workflow-json', preset.json || '');
        setValue('comfy-node-positive', preset.nodePositive || '');
        setValue('comfy-node-negative', preset.nodeNegative || '');
        setValue('comfy-node-width', preset.nodeWidth || '');
        setValue('comfy-node-height', preset.nodeHeight || '');
        setValue('comfy-node-seed', preset.nodeSeed || '');
        setValue('comfy-node-save-image', preset.nodeSaveImage || '');
        await persistSettings((draft) => {
            draft.selectedWorkflowPresetId = selectedWorkflowPresetId;
        }, '已切换工作流', { silent: true });
    });

    // 新建工作流 preset
    getSettingsElement('comfy-workflow-preset-add')?.addEventListener('click', async () => {
        const name = window.prompt('新工作流名称', `工作流 ${(getSettings().workflowPresets?.length || 0) + 1}`);
        if (!name) return;
        const newPreset = {
            ...createDefaultWorkflowPreset(),
            id: `workflow-${Date.now()}`,
            name,
        };
        await persistSettings((draft) => {
            draft.workflowPresets = [...(draft.workflowPresets || []), newPreset];
            draft.selectedWorkflowPresetId = newPreset.id;
        }, '已新建工作流');
        fillWorkflowPresetSelect(getSettings());
    });

    // 重命名工作流 preset
    getSettingsElement('comfy-workflow-preset-rename')?.addEventListener('click', async () => {
        const select = getSettingsElement('comfy-workflow-preset-select');
        const current = getSettings();
        const preset = current.workflowPresets?.find((item) => item.id === current.selectedWorkflowPresetId);
        if (!preset) return;
        const name = window.prompt('新名称', preset.name);
        if (!name) return;
        await persistSettings((draft) => {
            const target = draft.workflowPresets?.find((item) => item.id === current.selectedWorkflowPresetId);
            if (target) target.name = name;
        }, '已重命名');
        fillWorkflowPresetSelect(getSettings());
    });

    // 删除工作流 preset
    getSettingsElement('comfy-workflow-preset-delete')?.addEventListener('click', async () => {
        const current = getSettings();
        const preset = current.workflowPresets?.find((item) => item.id === current.selectedWorkflowPresetId);
        if (!preset) return;
        if (!window.confirm(`确定要删除工作流 "${preset.name}" 吗？`)) return;
        await persistSettings((draft) => {
            draft.workflowPresets = (draft.workflowPresets || []).filter(
                (item) => item.id !== current.selectedWorkflowPresetId
            );
            draft.selectedWorkflowPresetId = draft.workflowPresets?.[0]?.id || null;
        }, '已删除');
        fillWorkflowPresetSelect(getSettings());
    });

    // 内置工作流选择
    getSettingsElement('comfy-builtin-workflow')?.addEventListener('change', async () => {
        const builtinWorkflowId = getSettingsElement('comfy-builtin-workflow').value;
        const ok = await persistSettings((draft) => {
            draft.builtinWorkflowId = builtinWorkflowId;
        }, '已切换内置工作流', { silent: true });
        if (ok) refreshBuiltinWorkflowPanel(getSettings());
    });

    // 应用推荐参数
    getSettingsElement('comfy-builtin-workflow-apply')?.addEventListener('click', async () => {
        const builtinId = getSettingsElement('comfy-builtin-workflow')?.value
            || getSettings().builtinWorkflowId;
        const workflow = getBuiltinWorkflowDefinition(builtinId);
        const recommended = workflow.recommended || {};
        if (recommended.sampler) setValue('comfy-draw-sampler', recommended.sampler);
        if (recommended.scheduler) setValue('comfy-draw-scheduler', recommended.scheduler);
        if (recommended.steps) setValue('comfy-draw-steps', String(recommended.steps));
        if (recommended.cfg) setValue('comfy-draw-cfg', String(recommended.cfg));
        await persistSettings((draft) => {
            if (recommended.sampler) draft.sampler = recommended.sampler;
            if (recommended.scheduler) draft.scheduler = recommended.scheduler;
            if (recommended.steps) draft.steps = recommended.steps;
            if (recommended.cfg) draft.cfg = recommended.cfg;
        }, '已应用推荐参数', { silent: true });
    });

    // 展开/折叠高级参数
    getSettingsElement('comfy-toggle-advanced-params')?.addEventListener('click', () => {
        const section = getSettingsElement('comfy-advanced-params-section');
        const btn = getSettingsElement('comfy-toggle-advanced-params');
        if (!section || !btn) return;
        const hidden = section.classList.toggle('hidden');
        btn.innerHTML = hidden
            ? '<i class="fa-solid fa-chevron-down"></i> 展开'
            : '<i class="fa-solid fa-chevron-up"></i> 收起';
    });

    // 模式切换
    getSettingsElement('comfy-workflow-mode-simple')?.addEventListener('click', async () => {
        await setWorkflowMode('simple');
    });
    getSettingsElement('comfy-workflow-mode-custom')?.addEventListener('click', async () => {
        await setWorkflowMode('custom');
    });

    // 导入工作流 JSON 文件
    getSettingsElement('comfy-workflow-import')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        setValue('comfy-workflow-json', text);
        event.target.value = '';
    });

    // 清空工作流 JSON
    getSettingsElement('comfy-workflow-clear')?.addEventListener('click', () => {
        setValue('comfy-workflow-json', '');
    });

    // 保存工作流 preset（点保存按钮）
    getSettingsElement('comfy-workflow-preset-save')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const json = getSettingsElement('comfy-workflow-json')?.value || '';
        const nodeMap = buildWorkflowNodeMapFromForm();
        try {
            validateWorkflowPresetDraftOrThrow({ json, nodeMap });
        } catch (error) {
            updateStatus(button, 'error', error?.message || '校验失败');
            return;
        }
        await persistSettings((draft) => {
            const list = draft.workflowPresets || [];
            const idx = list.findIndex((item) => item.id === draft.selectedWorkflowPresetId);
            const updated = {
                ...createDefaultWorkflowPreset(),
                ...list[idx],
                ...nodeMap,
                json,
            };
            if (idx >= 0) list[idx] = updated;
            else list.push({ ...updated, id: draft.selectedWorkflowPresetId || `workflow-${Date.now()}` });
            draft.workflowPresets = list;
        }, '工作流已保存');
    });
}

// ──────────────── 模式切换辅助 ────────────────

export async function setWorkflowMode(mode) {
    const { getSettingsElement, persistSettings, getSettings } = deps();
    const simpleBtn = getSettingsElement('comfy-workflow-mode-simple');
    const customBtn = getSettingsElement('comfy-workflow-mode-custom');
    const simpleSection = getSettingsElement('comfy-simple-mode-section');
    const customSection = getSettingsElement('comfy-custom-mode-section');
    const isSimple = mode === 'simple';
    if (simpleBtn) simpleBtn.classList.toggle('active', isSimple);
    if (customBtn) customBtn.classList.toggle('active', !isSimple);
    if (simpleSection) simpleSection.classList.toggle('hidden', !isSimple);
    if (customSection) customSection.classList.toggle('hidden', isSimple);
    await persistSettings((draft) => {
        draft.workflowMode = isSimple ? 'simple' : 'custom';
    }, '已切换模式', { silent: true });
}

// ──────────────── 表单回填（settings → form） ────────────────

export function fillComfyWorkflowForm(settings = null) {
    const { setValue, getSettings } = deps();
    const current = settings || getSettings();
    setValue('comfy-draw-model', current.selectedModel || '');
    setValue('comfy-draw-sampler', current.sampler || 'euler');
    setValue('comfy-draw-scheduler', current.scheduler || 'normal');
    setValue('comfy-draw-steps', String(current.steps || 20));
    setValue('comfy-draw-cfg', String(current.cfg || 7));
    setValue('comfy-workflow-json', current.customWorkflow?.json || '');
    setValue('comfy-node-positive', current.customWorkflow?.nodePositive || '');
    setValue('comfy-node-negative', current.customWorkflow?.nodeNegative || '');
    setValue('comfy-node-width', current.customWorkflow?.nodeWidth || '');
    setValue('comfy-node-height', current.customWorkflow?.nodeHeight || '');
    setValue('comfy-node-seed', current.customWorkflow?.nodeSeed || '');
    setValue('comfy-node-save-image', current.customWorkflow?.nodeSaveImage || '');
    fillWorkflowPresetSelect(current);
    populateModelSelect(current.modelCache || []);
    refreshBuiltinWorkflowPanel(current);
    setWorkflowMode(current.workflowMode || 'simple').catch(() => {});
}

// ──────────────── 工具函数 ────────────────

function updateStatus(button, kind, text) {
    if (!button) return;
    button.dataset.lastStatus = kind;
    button.title = text;
}
