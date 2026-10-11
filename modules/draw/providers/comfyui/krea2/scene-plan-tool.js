// [K2] fork 自 shared/scene-plan-tool.js：逐字副本，差异 = 图片项末尾追加可选 other，
// 以及角色字段剔除 interact/uc（getScenePlanCharacterProperties 保持逐字，仅在组装
// charactersSchema 时剔除，便于上游同步）。上游同步时重拷原件后重放 [K2] 标记块即可。
import { SUBMIT_SCENE_PLAN_TOOL_NAME } from '../../../shared/scene-plan-contract.js';
import { normalizeScenePlannerProfile } from '../../../shared/scene-planner-profile.js';

// Model-facing instructions are prepared in the browser, not bundled into the executor.
function normalizeLimit(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
}

function stringSchema(description, { minLength = 0 } = {}) {
    return {
        type: 'string',
        ...(minLength > 0 ? { minLength } : {}),
        description,
    };
}

const CHARACTER_TYPES = Object.freeze(['girl', 'boy', 'woman', 'man', 'other', 'no_humans']);

const INTERACT_DESCRIPTIONS = Object.freeze({
    directional: '与其他角色的接触动作，带方向前缀：`source#动作` 发起方、`target#动作` 接受方、`mutual#动作` 互相。同一个互动分别写进每位参与角色自己的 interact；一个角色参与多个互动时逗号并列。没有互动时省略。',
    plain: '与其他角色的接触动作 tag，如 `hugging`、`holding hands`。没有互动时省略。',
});

const UC_DESCRIPTIONS = Object.freeze({
    character: '只针对该角色排除的 tag：与当前状态互斥的特征（无胸罩→`bra`、脱帽→`hat`）、因视角或遮挡不可见的部位、与另一角色相反的情绪。作为该角色专属的负向生效。通用画质负面由用户预设负责，不写在这里。没有时省略。',
    global: 'Tags to exclude from the entire image. All characters\' uc values are merged into one global negative prompt, so include a tag only when it is unwanted for every subject and the background. A feature or emotion needed by another character stays out of uc. General quality negatives come from the user\'s preset. Omit when there is nothing to exclude.',
});

const CENTER_SCHEMAS = Object.freeze({
    grid: () => ({
        type: 'string',
        pattern: '^[A-E][1-5]$',
        description: '角色在画面中的位置，5×5 网格：列 A–E 从左到右，行 1–5 从上到下。居中（C3）时省略。多个角色可以重叠（拥抱、亲吻）。',
    }),
    normalized: () => ({
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y'],
        properties: {
            x: { type: 'number', minimum: 0, maximum: 1 },
            y: { type: 'number', minimum: 0, maximum: 1 },
        },
        description: '角色在画面中的位置，左上角 (0, 0)，右下角 (1, 1)。居中 (0.5, 0.5) 时省略。多个角色可以重叠（拥抱、亲吻）。',
    }),
});

/**
 * Field semantics live here and nowhere else: the prose prompts only decide *what* to draw.
 * Provider differences (center support, interact syntax, uc scope) come from the profile.
 */
export function getScenePlanCharacterProperties(profile) {
    const effective = normalizeScenePlannerProfile(profile);
    return {
        name: stringSchema(
            '角色名。已录入角色用【已录入角色】列出的规范名，原文用别名也归一到规范名。未知角色用原文名字，无名时用简短称呼。',
            { minLength: 1 },
        ),
        // [K2] type 提到 danbooru 之前：与 assembleCharacterPrompts 的拼接顺序一致
        // （type → danbooru → appear → costume → action）。type 的文案改为"类型和方位"是 K2 的另一处差异。
        type: stringSchema(
            `人物类型和方位，比如A girl on the left,`,
        ),
        danbooru: stringSchema(
            '该角色的 Danbooru 身份 tag，下划线格式：同人角色 `character_name_(series)`，原创角色 `中文名_(original)`。仅在确定时提交；已录入角色省略。',
        ),
        appear: stringSchema(
            'Stable appearance visible in this composition, such as hair, eyes or build. Every unregistered character needs a non-empty appearance description. Omit for registered characters, whose appearance comes from the character library.',
        ),
        costume: stringSchema(
            '本图实际穿着与状态：款式、颜色、细节、穿着状态（敞开、破损、湿透、滑落）。已录入角色有服装参考时，选一套或其变体并严格按画面状态改写，禁止省略任何镜头里出现的信息，不把多套拼在一起。没有服装事实时省略。优先用tag，难以描述的用自然语言',
        ),
        action: stringSchema(
            '用英文自然语言描述本图该角色的姿态、动作、视线、面向、表情等外貌参考之外的信息，外貌参考之内的不要写。交互动作在此不是必要的',
            { minLength: 1 },
        ),
        interact: stringSchema(INTERACT_DESCRIPTIONS[effective.interactSyntax]),
        uc: stringSchema(UC_DESCRIPTIONS[effective.ucScope]),
        ...(effective.centerMode === 'none' ? {} : { center: CENTER_SCHEMAS[effective.centerMode]() }),
    };
}

export function createSubmitScenePlanTool(options = {}) {
    const maxImages = normalizeLimit(options.maxImages);
    const maxPlanImages = normalizeLimit(options.maxPlanImages);
    const maxCharactersPerImage = normalizeLimit(options.maxCharactersPerImage);
    const insertPointCount = normalizeLimit(options.insertPointCount);
    const profile = normalizeScenePlannerProfile(options.profile);
    const maxPlanItems = maxImages || maxPlanImages;
    // [K2] 字段集 = 原件去掉角色级 interact/uc：Krea2 不走互动语法，角色级负向也不收
    // （全局负向由用户预设负责）。getScenePlanCharacterProperties 保持逐字，仅在此处剔除这两个字段。
    const characterProperties = { ...getScenePlanCharacterProperties(profile) };
    delete characterProperties.interact;
    delete characterProperties.uc;
    const charactersSchema = {
        type: 'array',
        ...(maxCharactersPerImage ? { maxItems: maxCharactersPerImage } : {}),
        // [K2] 拼接顺序描述去掉 interact（原件结尾为 "→ interact"）。
        description: '画面中出现的角色，按重要度排序。纯风景、物件、建筑主体时为空数组。每项的字段按 type → danbooru → appear → costume → action 的顺序拼成该角色的提示词。',
        items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'action'],
            properties: characterProperties,
        },
    };
    const imagesSchema = {
        type: 'array',
        minItems: maxImages || 1,
        ...(maxPlanItems ? { maxItems: maxPlanItems } : {}),
        description: '图片任务，按阅读顺序排列。数量约束见消息末尾。',
        items: {
            type: 'object',
            additionalProperties: false,
            required: ['index', 'insert_after', 'scene', 'characters'],
            properties: {
                index: { type: 'integer', minimum: 1, description: '本图序号，从 1 起。' },
                insert_after: {
                    type: 'integer',
                    minimum: 1,
                    ...(insertPointCount ? { maximum: insertPointCount } : {}),
                    description: 'The number N of an existing `【插图点 N】` marker in <content>. Choose the nearest marker after the moment depicted. Images at the same marker appear in array order.',
                },
                scene: stringSchema(
                    '用一句英文短句简述此画面，不要写人物名字',
                    { minLength: 1 },
                ),
                characters: charactersSchema,
                // [K2] other：追加位，拼在所有角色之后（整条提示词最后）。合同侧转成伪角色条目
                // 垫在 chars 末尾，经 assembleCharacterPrompts + charPositive 按序拼入
                // （见 krea2/scene-plan-contract.js 的 [K2] 块）。
                other: stringSchema(
                    '用英文自然语言描写人物之间的交互动作，环境信息，以及光影，镜头等信息。交互时不要写人物名字，要写类型和方位比如the girl on the left。环境信息不能有遗漏',
                ),
            },
        },
    };

    return {
        type: 'function',
        function: {
            name: SUBMIT_SCENE_PLAN_TOOL_NAME,
            description: '提交本次全部图片任务。一个回合只调用一次。',
            parameters: {
                type: 'object',
                additionalProperties: false,
                required: ['images'],
                properties: {
                    images: imagesSchema,
                },
            },
        },
    };
}
