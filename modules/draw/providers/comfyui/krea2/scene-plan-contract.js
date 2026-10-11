// [K2] fork 自 shared/scene-plan-contract.js：校验逻辑与原件逐字一致，差异仅两点——
// 1) 工具 schema 的角色字段去掉 interact/uc（合同不感知：normalizeCharacter 对缺失字段本就归空）；
// 2) 图片项末尾的可选 other 转成伪角色条目垫在 chars 末尾（见 normalizeImages 的 [K2] 块——
//    经 assembleCharacterPrompts 产出追加在所有角色之后的 tag）。
// ScenePlannerError / 工具名 / 错误分类 / 纠错语义沿用原件——instanceof 一致性是
// draw-agent-runtime 纠错循环工作的前提。上游同步时重拷原件后重放 [K2] 标记块。
import { repairScenePlanArguments } from '../../../shared/scene-plan-arguments.js';
import { ScenePlannerError, SUBMIT_SCENE_PLAN_TOOL_NAME } from '../../../shared/scene-plan-contract.js';

const REQUIRED_IMAGE_FIELDS = Object.freeze(['insert_after', 'scene', 'characters']);
// Unknown or interrupted provider finishes must not be promoted into a successful plan.
const REPAIR_FINISH_REASONS = new Set(['', 'stop', 'completed', 'end_turn', 'tool_use', 'tool_calls', 'function_call']);

function normalizeLimit(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
}

function failSchema(path, message, value, expected = message) {
    throw new ScenePlannerError(
        `场景计划参数无效：${path} ${message}`,
        'TOOL_ARGUMENTS_SCHEMA_INVALID',
        { path, rule: message, received: value, expected },
    );
}

function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        failSchema(path, '必须是 object', value);
    }
}

function assertExactFields(value, fields, path) {
    assertRequiredFields(value, fields, path);
    const expected = new Set(fields);
    for (const key of Object.keys(value)) {
        if (!expected.has(key)) failSchema(`${path}.${key}`, '是不允许的字段', value[key]);
    }
}

function assertRequiredFields(value, fields, path) {
    assertObject(value, path);
    for (const key of fields) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            failSchema(`${path}.${key}`, '是必填字段', undefined);
        }
    }
}

function requireString(value, path, { allowEmpty = false } = {}) {
    if (typeof value !== 'string') failSchema(path, '必须是 string', value);
    const normalized = value.trim();
    if (!allowEmpty && !normalized) failSchema(path, '不能为空', value);
    return normalized;
}

function optionalString(value, key, path) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === null) return '';
    return requireString(value[key], `${path}.${key}`, { allowEmpty: true });
}

function requirePositiveInteger(value, path) {
    if (!Number.isInteger(value) || value < 1) failSchema(path, '必须是大于 0 的整数', value);
    return value;
}

function normalizeCharacterLookup(presentCharacters = []) {
    const lookup = new Map();
    for (const character of Array.isArray(presentCharacters) ? presentCharacters : []) {
        const canonicalName = String(character?.name || '').trim();
        if (!canonicalName) continue;
        const names = [canonicalName, ...(Array.isArray(character.aliases) ? character.aliases : [])];
        names.forEach((name) => {
            const key = String(name || '').trim().toLocaleLowerCase();
            if (key && !lookup.has(key)) lookup.set(key, canonicalName);
        });
    }
    return lookup;
}

const GRID_COL = Object.freeze({ A: 0.1, B: 0.3, C: 0.5, D: 0.7, E: 0.9 });
const GRID_ROW = Object.freeze({ 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9 });

function normalizeCenter(value, path, centerMode) {
    if (value === undefined) return { x: 0.5, y: 0.5 };
    if (centerMode === 'normalized') {
        assertExactFields(value, ['x', 'y'], path);
        const parseCoordinate = (coordinate, coordinatePath) => {
            const isNumber = typeof coordinate === 'number';
            const isNumericString = typeof coordinate === 'string' && coordinate.trim() !== '';
            const number = isNumber || isNumericString ? Number(coordinate) : Number.NaN;
            if (!Number.isFinite(number) || number < 0 || number > 1) {
                failSchema(coordinatePath, '必须是 0～1 的数字', coordinate);
            }
            return number;
        };
        const x = parseCoordinate(value.x, `${path}.x`);
        const y = parseCoordinate(value.y, `${path}.y`);
        return { x, y };
    }
    const grid = requireString(value, path).toUpperCase();
    const match = grid.match(/^([A-E])([1-5])$/);
    if (!match) failSchema(path, '必须是 A1～E5 坐标', value);
    return { x: GRID_COL[match[1]], y: GRID_ROW[match[2]] };
}

function normalizeCharacter(value, path, knownNameLookup, centerMode) {
    assertRequiredFields(value, ['name'], path);
    const returnedName = requireString(value.name, `${path}.name`);
    const canonicalName = knownNameLookup.get(returnedName.toLocaleLowerCase()) || '';
    const type = optionalString(value, 'type', path);
    const appear = optionalString(value, 'appear', path);
    if (!canonicalName && !appear) failSchema(`${path}.appear`, '未知角色必须填写外貌', value.appear);
    const center = normalizeCenter(value.center, `${path}.center`, centerMode);

    return {
        name: canonicalName || returnedName,
        danbooru: optionalString(value, 'danbooru', path),
        // [K2] 已录入角色保留场景 type：type 承载画面方位等随图变化的信息（角色库是静态的），
        // 组装层（character-prompts.js）会让非空场景 type 打头并顶替库 type。
        // 原生合同仍清空场景 type，原生组装自动回落库 type，行为不变。
        type,
        appear: canonicalName ? '' : appear,
        costume: optionalString(value, 'costume', path),
        action: optionalString(value, 'action', path),
        interact: optionalString(value, 'interact', path),
        uc: optionalString(value, 'uc', path),
        center,
    };
}

function normalizeImages(images, options = {}) {
    if (!Array.isArray(images)) failSchema('images', '必须是 array', images);
    if (!images.length) {
        throw new ScenePlannerError(
            '场景计划没有图片任务。',
            'NO_IMAGE_TASKS',
            {
                path: 'images',
                rule: '必须至少提交一个图片任务',
                received: 0,
                expected: '非空 images 数组',
            },
        );
    }
    const maxImages = normalizeLimit(options.maxImages);
    const maxPlanImages = normalizeLimit(options.maxPlanImages);
    const maxCharactersPerImage = normalizeLimit(options.maxCharactersPerImage);
    const centerMode = options.centerMode === 'normalized' ? 'normalized' : 'grid';
    if (maxImages && images.length !== maxImages) {
        failSchema('images', `本次必须恰好包含 ${maxImages} 项`, images.length);
    }
    if (!maxImages && maxPlanImages && images.length > maxPlanImages) {
        failSchema('images', `本次最多包含 ${maxPlanImages} 项`, images.length);
    }
    const knownNameLookup = normalizeCharacterLookup(options.presentCharacters);
    const sceneSource = options.sceneSource;
    const sourcePoints = new Map((Array.isArray(sceneSource?.points) ? sceneSource.points : [])
        .map((point) => [point.number, point]));
    const tasks = images.map((image, imageIndex) => {
        const path = `images[${imageIndex}]`;
        assertRequiredFields(image, REQUIRED_IMAGE_FIELDS, path);
        const insertAfter = requirePositiveInteger(image.insert_after, `${path}.insert_after`);
        const sourcePoint = sourcePoints.get(insertAfter);
        if (!sourcePoint) {
            const insertPath = `${path}.insert_after`;
            throw new ScenePlannerError(
                `场景计划参数无效：${insertPath} 必须引用本次 <content> 中存在的插图点编号`,
                'INSERT_POINT_INVALID',
                {
                    path: insertPath,
                    rule: '必须引用本次正文中存在的插图点编号',
                    received: insertAfter,
                    expected: sourcePoints.size ? `1～${sourcePoints.size}` : '本次正文没有可用插图点',
                },
            );
        }
        if (!Array.isArray(image.characters)) failSchema(`${path}.characters`, '必须是 array', image.characters);
        if (maxCharactersPerImage && image.characters.length > maxCharactersPerImage) {
            failSchema(`${path}.characters`, `最多包含 ${maxCharactersPerImage} 人`, image.characters.length);
        }
        const chars = image.characters.map((character, characterIndex) => (
            normalizeCharacter(character, `${path}.characters[${characterIndex}]`, knownNameLookup, centerMode)
        ));
        // [K2] other（可选）→ 伪角色条目垫在 chars 末尾：空名短路 findEnabledCharacterByName，
        // 不会撞已知角色库；assembleCharacterPrompts 对未知角色取 appear 产出 prompt，compiler 的
        // charPositive 按序拼接 → other 落在所有角色之后（整条提示词最后）。放在人数限额检查
        // 之后 push，不占 maxCharactersPerImage 名额；未提交 other 时与原件行为逐字节一致。
        const other = typeof image.other === 'string' ? image.other.trim() : '';
        if (other) chars.push({ name: '', appear: other });
        return {
            index: imageIndex + 1,
            scene: requireString(image.scene, `${path}.scene`),
            chars,
            placement: {
                mode: 'source',
                insertAfter,
                offset: sourcePoint.offset,
                sourceHash: String(sceneSource?.sourceHash || ''),
            },
        };
    });
    return tasks;
}

function parseArguments(rawArguments, { allowRepair = true } = {}) {
    if (rawArguments && typeof rawArguments === 'object' && !Array.isArray(rawArguments)) {
        return { parameters: rawArguments };
    }
    if (typeof rawArguments !== 'string') {
        throw new ScenePlannerError(
            'submit_scene_plan 参数不是 JSON object。',
            'TOOL_ARGUMENTS_INVALID_JSON',
            {
                path: 'toolCalls[0].arguments',
                rule: '必须是合法 JSON object',
                received: typeof rawArguments,
                expected: 'JSON object 字符串',
            },
        );
    }
    try {
        const parsed = JSON.parse(rawArguments);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new TypeError('root must be an object');
        }
        return { parameters: parsed };
    } catch (error) {
        const recovered = allowRepair ? repairScenePlanArguments(rawArguments) : null;
        if (recovered) return recovered;
        throw new ScenePlannerError(
            `submit_scene_plan 参数 JSON 损坏或截断：${error?.message || '无法解析'}`,
            'TOOL_ARGUMENTS_INVALID_JSON',
            {
                path: 'toolCalls[0].arguments',
                rule: '必须是合法且完整的 JSON object',
                received: String(rawArguments).slice(0, 160),
                expected: '完整 JSON object',
            },
            { cause: error },
        );
    }
}

export function parseSubmittedScenePlan(result = {}, options = {}) {
    const toolCalls = Array.isArray(result?.toolCalls) ? result.toolCalls : [];
    if (!toolCalls.length) {
        const presetName = String(options.presetName || '').trim();
        const provider = String(options.provider || '').trim();
        const model = String(options.model || '').trim();
        const context = [presetName, provider, model].filter(Boolean).join(' / ');
        throw new ScenePlannerError(
            `本次响应没有解析到 submit_scene_plan Tool Call${context ? `（${context}）` : ''}。这不代表模型不支持 Tool Calling，请根据最近一次实际请求核对返回协议。`,
            'TOOL_CALL_MISSING',
            {
                path: 'toolCalls',
                rule: '必须且只能调用一次 submit_scene_plan',
                received: 0,
                expected: '1 个 submit_scene_plan Tool Call',
            },
        );
    }
    if (toolCalls.length > 1) {
        throw new ScenePlannerError(
            `场景规划必须只提交一次，但模型返回了 ${toolCalls.length} 个 Tool Call。`,
            'TOOL_CALL_MULTIPLE',
            {
                path: 'toolCalls',
                rule: '必须且只能调用一次 submit_scene_plan',
                received: toolCalls.length,
                expected: '1 个 submit_scene_plan Tool Call',
            },
        );
    }
    const toolCall = toolCalls[0] || {};
    if (toolCall.name !== SUBMIT_SCENE_PLAN_TOOL_NAME) {
        throw new ScenePlannerError(
            `模型调用了错误的 Tool：${toolCall.name || '未命名'}。`,
            'TOOL_CALL_NAME_INVALID',
            {
                path: 'toolCalls[0].name',
                rule: '必须调用 submit_scene_plan',
                received: toolCall.name || '',
                expected: SUBMIT_SCENE_PLAN_TOOL_NAME,
            },
        );
    }
    const { parameters, argumentRepair } = parseArguments(toolCall.arguments, {
        allowRepair: !result.refused && REPAIR_FINISH_REASONS.has(String(result.finishReason || '').toLowerCase()),
    });
    // Planning notes are model-facing data, not part of the image execution contract.
    if (!Object.hasOwn(parameters, 'images')) failSchema('parameters.images', '是必填字段', undefined);
    const tasks = normalizeImages(parameters.images, options);
    return { tasks, ...(argumentRepair ? { argumentRepair } : {}) };
}
