import { observeAsyncCallback } from '../../../../shared/common/async-errors.js';
import { createPromptLayoutEditor, normalizeLayout } from '../../shared/prompt-layout-editor.js';
import { buildScenePlannerChainPreview } from '../../shared/scene-planner-frame.js';
import { renderScenePlannerChain } from '../../shared/scene-planner-chain-view.js';
import { parseFieldDescriptions } from '../../shared/scene-plan-descriptions.js';
import { NATURAL_PROMPT_DEFAULTS } from './prompts.js';
import { naturalPlannerOptions } from './planning-input.js';
import { bindSettingsPresetBar } from './settings-preset-bar.js';
import { MULTIMODAL_COPY as COPY } from './copy.js';

const TEMPLATE_FILE_TYPE = 'lwb-natural-draw-prompt';
const TEMPLATE_FILE_VERSION = 1;
const FIELD_KEYS = Object.keys(NATURAL_PROMPT_DEFAULTS);

export function bindPromptEditor({ document, provider, getState, persist }) {
    const view = document.defaultView;
    const parking = document.getElementById('mm-prompt-editors');
    const container = document.getElementById('mm-layout');
    const extra = document.getElementById('mm-extra-prompt-fields');
    const fields = {};
    const editors = {};
    const blocks = { opening: ['topSystem'], guide: ['tagGuideContent'], rules: ['sceneRules'], tools: ['fieldDescriptions'] };
    let draftLayout;
    let owner;
    const readFields = () => ({ ...Object.fromEntries(FIELD_KEYS.map(key => [key, fields[key].value])), layout: draftLayout });
    const create = (tag, classes, text = '') => {
        const node = document.createElement(tag);
        if (classes) node.className = classes;
        if (text) node.textContent = text;
        return node;
    };
    const button = (label, action) => {
        const node = create('button', 'btn btn-sm', label);
        node.type = 'button';
        node.addEventListener('click', action);
        return node;
    };
    const preview = create('details', 'card prompt-advanced-card');
    const summary = create('summary', 'prompt-card-header');
    summary.append(create('div', 'card-title', COPY.requestPreview));
    const fixed = create('details', 'draw-disclosure');
    const system = create('pre', 'mm-system-rule');
    fixed.append(create('summary', '', COPY.fixedSystemRule), system);
    const chainRoot = create('div', 'prompt-chain-container');
    const status = create('div', 'status-text');
    preview.append(summary, fixed, status, chainRoot);

    function renderPreview() {
        if (!preview.open || !owner) return;
        try {
            const settings = getState();
            const preset = { id: owner, ...readFields() };
            settings.selectedPromptPresetId = owner;
            settings.promptPresets = [preset];
            const { plannerProfile, systemInstruction, modelGuide } = naturalPlannerOptions(provider, settings);
            const descriptions = parseFieldDescriptions(preset.fieldDescriptions);
            const draftContents = {
                topSystem: preset.topSystem, tagGuide: modelGuide, sceneRules: preset.sceneRules,
            };
            const chain = buildScenePlannerChainPreview({ profile: plannerProfile, descriptions, layout: draftLayout, hasTagGuide: Boolean(modelGuide) });
            for (const row of chain) {
                for (const section of row.sections || []) {
                    if (!section.editable) continue;
                    section.editable = false;
                    section.content = draftContents[section.key];
                    if (section.key === 'tagGuide') section.summary = COPY.tagGuideContent;
                }
            }
            system.textContent = systemInstruction;
            status.textContent = '';
            renderScenePlannerChain(chainRoot, chain);
        } catch (error) {
            status.className = 'status-text error';
            status.textContent = error.message;
            chainRoot.replaceChildren();
        }
    }
    preview.addEventListener('toggle', renderPreview);
    for (const [id, keys] of Object.entries(blocks)) {
        const editor = create('div');
        editors[id] = editor;
        for (const key of keys) {
            const label = create('label', 'form-group');
            const field = create('textarea', 'prompt-textarea');
            field.rows = 5;
            fields[key] = field;
            label.append(create('span', 'form-label', COPY[key]), field);
            field.addEventListener('input', () => layoutEditor.refreshSummaries());
            field.addEventListener('change', renderPreview);
            editor.append(label, button(COPY.restoreDefault, () => {
                field.value = NATURAL_PROMPT_DEFAULTS[key];
                layoutEditor.refreshSummaries();
                renderPreview();
            }));
        }
        parking.append(editor);
    }
    const layoutEditor = createPromptLayoutEditor({
        document, container, builtinEditors: editors, editorParking: parking,
        getOwnerKey: () => owner, getLayout: () => draftLayout,
        getSavedLayout: () => getState().promptPresets.find(item => item.id === owner)?.layout,
        onChange: next => { draftLayout = next; },
        confirm: text => view.confirm(text),
        describeBuiltin: id => editors[id] ? {
            label: id === 'guide' ? COPY.tagGuideContent : undefined,
            summary: fields[blocks[id][0]].value,
            action: 'edit',
        } : null,
        collapseId: 'prompt-layout',
    });
    const bar = bindSettingsPresetBar({
        root: document.querySelector('[data-presets="prompt"]'), label: COPY.prompts, getState, persist,
        listKey: 'promptPresets', selectionKey: 'selectedPromptPresetId', readFields,
        validateFields: value => parseFieldDescriptions(value.fieldDescriptions),
        fillFields: (value, id) => {
            owner = id;
            draftLayout = value.layout;
            for (const key of FIELD_KEYS) fields[key].value = value[key];
            layoutEditor.render();
            renderPreview();
        },
    });
    const tools = create('div', 'btn-group');
    const file = create('input');
    file.type = 'file';
    file.accept = '.json';
    file.hidden = true;
    file.addEventListener('change', observeAsyncCallback(async () => {
        const selected = file.files[0];
        file.value = '';
        if (!selected) return;
        try {
            const { type, version, name, ...value } = JSON.parse(await selected.text());
            if (type !== TEMPLATE_FILE_TYPE || version !== TEMPLATE_FILE_VERSION || typeof name !== 'string' || !name.trim()
                || FIELD_KEYS.some(key => typeof value[key] !== 'string')) throw new Error(COPY.invalidPromptImport);
            const layout = value.layout === undefined ? undefined : normalizeLayout(value.layout).layout;
            await bar.saveAs(name.trim(), { ...Object.fromEntries(FIELD_KEYS.map(key => [key, value[key]])), layout });
        } catch (error) {
            bar.report('error', error instanceof SyntaxError ? COPY.invalidPromptImport : error.message || COPY.invalidPromptImport);
        }
    }, { source: import.meta.url, operation: 'importPromptPreset' }));
    tools.append(
        file, button(COPY.importPrompt, () => file.click()),
        button(COPY.exportPrompt, () => {
            const name = bar.currentName();
            const data = { type: TEMPLATE_FILE_TYPE, version: TEMPLATE_FILE_VERSION, name, ...readFields() };
            const url = view.URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const link = create('a');
            link.href = url;
            link.download = `${name}.json`;
            link.click();
            setTimeout(() => view.URL.revokeObjectURL(url), 0);
        }),
        button(COPY.restorePrompt, () => {
            if (!view.confirm(COPY.resetPromptConfirm)) return;
            draftLayout = undefined;
            for (const key of FIELD_KEYS) fields[key].value = NATURAL_PROMPT_DEFAULTS[key];
            layoutEditor.render();
            renderPreview();
        }),
    );
    extra.append(create('p', 'form-hint', COPY.promptSectionsHint), tools, preview);
    return { render: bar.render, isDirty: bar.isDirty, destroy: () => layoutEditor.destroy() };
}
