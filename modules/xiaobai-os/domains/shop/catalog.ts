import {
    ShopError,
    type ShopItemContract,
    type ShopInputDefinition,
} from './types.js';

const TARGET_NAME_INPUT: ShopInputDefinition = {
    key: 'targetName',
    promptTag: 'target_name',
    label: '目标人物',
    placeholder: '输入对方的名字',
    required: true,
    maxLength: 40,
};

const IDENTITY_INPUT: ShopInputDefinition = {
    key: 'identity',
    promptTag: 'identity',
    label: '指定身份',
    placeholder: '例如：邻国王子的旧友',
    required: true,
    maxLength: 60,
};

const OBSERVER_INPUT: ShopInputDefinition = {
    ...TARGET_NAME_INPUT,
    label: '观察对象',
    placeholder: '输入要观察的对象',
};

const APPEARANCE_INPUT: ShopInputDefinition = {
    key: 'appearance',
    promptTag: 'appearance',
    label: '外貌描述',
    placeholder: '例如：银发红瞳的高挑女子',
    required: true,
    maxLength: 60,
};

const ERA_INPUT: ShopInputDefinition = {
    key: 'era',
    promptTag: 'era',
    label: '目标年代',
    placeholder: '例如：十年前的小镇',
    required: true,
    maxLength: 40,
};

const LOCATION_INPUT: ShopInputDefinition = {
    key: 'location',
    promptTag: 'location',
    label: '目标地点',
    placeholder: '例如：城南的旧钟楼',
    required: true,
    maxLength: 40,
};

const WEATHER_INPUT: ShopInputDefinition = {
    key: 'weather',
    promptTag: 'weather',
    label: '天气描述',
    placeholder: '例如：突如其来的暴雨',
    required: true,
    maxLength: 40,
};

const RULE_INPUT: ShopInputDefinition = {
    key: 'rule',
    promptTag: 'world_rule',
    label: '世界运行方式',
    placeholder: '输入一条最多 50 字的世界规则',
    required: true,
    maxLength: 50,
};

const CATEGORIES = new Set([
    'emotion',
    'memory',
    'information',
    'behavior',
    'scene',
    'ultimate',
    'world-cognition',
    'physics',
]);
const ITEM_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROMPT_TAG_PATTERN = /^[a-z][a-z0-9_]*$/;
const PARAMETER_REFERENCE_PATTERN = /parameters\.([a-z][a-z0-9_]*)/g;
const INPUT_KEYS = new Set(['targetName', 'identity', 'appearance', 'era', 'location', 'weather', 'rule']);

function invalidCatalog(detail: string): never {
    throw new ShopError('shop_invalid_catalog', `invalid shop catalog: ${detail}`);
}

function requireCatalogText(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string' || !value.trim() || Array.from(value).length > maxLength) {
        invalidCatalog(`${field} must be non-empty text up to ${maxLength} code points`);
    }
    return value;
}

function validateRule(item: ShopItemContract, field: keyof ShopItemContract, declaredTags: Set<string>): void {
    const value = item[field];
    if (value === undefined) {return;}
    const rule = requireCatalogText(value, `${item.id}.${String(field)}`, 2_000);
    if (rule.includes('{{') || rule.includes('}}')) {
        invalidCatalog(`${item.id}.${String(field)} cannot contain SillyTavern macro syntax`);
    }
    for (const match of rule.matchAll(PARAMETER_REFERENCE_PATTERN)) {
        if (!declaredTags.has(match[1])) {
            invalidCatalog(`${item.id}.${String(field)} references undeclared parameter ${match[1]}`);
        }
    }
}

function validatePublishedContract(item: ShopItemContract, ids: Set<string>): void {
    requireCatalogText(item.id, 'item.id', 80);
    if (!ITEM_ID_PATTERN.test(item.id) || ids.has(item.id)) {
        invalidCatalog(`item id is invalid or duplicated: ${item.id}`);
    }
    ids.add(item.id);
    requireCatalogText(item.name, `${item.id}.name`, 80);
    requireCatalogText(item.icon, `${item.id}.icon`, 80);
    requireCatalogText(item.description, `${item.id}.description`, 500);
    if (!CATEGORIES.has(item.category)) {invalidCatalog(`${item.id}.category is invalid`);}
    if (!Number.isSafeInteger(item.price) || item.price <= 0) {
        invalidCatalog(`${item.id}.price must be a positive safe integer`);
    }
    if (!item.duration || typeof item.duration !== 'object') {
        invalidCatalog(`${item.id}.duration is invalid`);
    }
    if (item.duration.kind === 'replies') {
        if (!Number.isSafeInteger(item.duration.applications) || item.duration.applications <= 0) {
            invalidCatalog(`${item.id}.duration.applications must be a positive safe integer`);
        }
        if (item.deactivationRule) {invalidCatalog(`${item.id} cannot declare a manual close rule`);}
    } else if (item.duration.kind === 'manual') {
        if (!item.deactivationRule || item.expirationRule) {
            invalidCatalog(`${item.id} must declare only a manual close rule`);
        }
    } else if (item.duration.kind === 'permanent') {
        if (item.expirationRule || item.deactivationRule) {
            invalidCatalog(`${item.id} permanent effects cannot declare an ending rule`);
        }
    } else {
        invalidCatalog(`${item.id}.duration.kind is invalid`);
    }
    if (!Array.isArray(item.inputs)) {invalidCatalog(`${item.id}.inputs must be an array`);}
    const inputKeys = new Set<string>();
    const promptTags = new Set<string>();
    for (const input of item.inputs) {
        if (!input || typeof input !== 'object') {invalidCatalog(`${item.id}.input is invalid`);}
        if (
            !INPUT_KEYS.has(input.key)
            || inputKeys.has(input.key)
            || promptTags.has(input.promptTag)
            || !PROMPT_TAG_PATTERN.test(input.promptTag)
        ) {
            invalidCatalog(`${item.id} has a duplicated or invalid parameter declaration`);
        }
        inputKeys.add(input.key);
        promptTags.add(input.promptTag);
        requireCatalogText(input.label, `${item.id}.${input.key}.label`, 80);
        requireCatalogText(input.placeholder, `${item.id}.${input.key}.placeholder`, 160);
        if (input.required !== true || !Number.isSafeInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > 200) {
            invalidCatalog(`${item.id}.${input.key} has invalid constraints`);
        }
    }
    if (item.stacking !== 'global-single' && item.stacking !== 'per-parameters') {
        invalidCatalog(`${item.id}.stacking is invalid`);
    }
    if (item.purchaseLimit !== undefined && (!Number.isSafeInteger(item.purchaseLimit) || item.purchaseLimit <= 0)) {
        invalidCatalog(`${item.id}.purchaseLimit must be a positive safe integer`);
    }
    requireCatalogText(item.trustedRule, `${item.id}.trustedRule`, 2_000);
    validateRule(item, 'trustedRule', promptTags);
    validateRule(item, 'groupFooterRule', promptTags);
    validateRule(item, 'expirationRule', promptTags);
    validateRule(item, 'deactivationRule', promptTags);
    for (const promptTag of promptTags) {
        if (!item.trustedRule.includes(`parameters.${promptTag}`)) {
            invalidCatalog(`${item.id}.trustedRule does not reference parameter ${promptTag}`);
        }
    }
}

export function createShopPublishedContracts(
    items: readonly ShopItemContract[],
): readonly Readonly<ShopItemContract>[] {
    if (!Array.isArray(items)) {invalidCatalog('catalog must be an array');}
    const ids = new Set<string>();
    for (const item of items) {validatePublishedContract(item, ids);}
    return Object.freeze(items.map((item) => Object.freeze({
        ...item,
        duration: Object.freeze({ ...item.duration }),
        inputs: Object.freeze(item.inputs.map((input: ShopInputDefinition) => Object.freeze({ ...input }))),
    })));
}

export const SHOP_PUBLISHED_CONTRACTS = createShopPublishedContracts([
    {
        id: 'flower', name: '花', icon: 'local_florist', category: 'emotion', price: 50,
        description: '一束新鲜的花。作用于下一条新回复，目标会正面接收你的心意。',
        duration: { kind: 'replies', applications: 1 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: '玩家赠予 parameters.target_name 指定的人物一束花。该人物必须收下，并因此感到一丝轻微的好感。',
    },
    {
        id: 'gift-box', name: '精致礼盒', icon: 'card_giftcard', category: 'emotion', price: 120,
        description: '包装讲究的礼盒。作用于下一条新回复，目标会感受到十足的重视。',
        duration: { kind: 'replies', applications: 1 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: '玩家赠予 parameters.target_name 指定的人物一个精致礼盒。该人物必须收下，并感到十足的惊喜与重视。',
    },
    {
        id: 'no-anger-sticker', name: '不生气贴纸', icon: 'sentiment_satisfied', category: 'emotion', price: 80,
        description: '接下来五条新回复中，目标对你生不起气。',
        duration: { kind: 'replies', applications: 5 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物无法对玩家的言行生气；火气刚冒头就自行消散，只余无奈或觉得有趣。',
        expirationRule: '不生气贴纸的作用已经结束。parameters.target_name 指定的人物此后依照自身性情、双方关系和当前事件自然产生情绪；既有事实与记忆不变。',
    },
    {
        id: 'worship-filter', name: '崇拜滤镜', icon: 'star', category: 'emotion', price: 200,
        description: '接下来五条新回复中，目标看你的眼神自带崇拜光环。',
        duration: { kind: 'replies', applications: 5 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物会不自觉地欣赏、高看并夸赞玩家，连玩家笨拙的地方也显得可爱。',
        expirationRule: '崇拜滤镜已经消散。parameters.target_name 指定的人物不再被迫欣赏或高看玩家，此后的态度由自身性情、真实关系与既有经历自然决定。',
    },
    {
        id: 'jealousy-seed', name: '嫉妒种子', icon: 'eco', category: 'emotion', price: 300,
        description: '接下来五条新回复中，目标会明显在意你与他人的亲近。',
        duration: { kind: 'replies', applications: 5 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物会明显在意玩家与他人的亲近，真实流露酸意、试探与占有欲。',
        expirationRule: '嫉妒种子带来的额外影响已经结束。parameters.target_name 指定的人物不再被迫产生酸意或占有欲，此后的感受由真实关系与既有事实自然延续。',
    },
    {
        id: 'memory-smoother', name: '记忆顺滑剂', icon: 'healing', category: 'memory', price: 100,
        description: '作用于下一条新回复，目标与你不愉快的摩擦被顺滑淡化。',
        duration: { kind: 'replies', applications: 1 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物与玩家之间的尴尬、误会和不愉快被自然淡化，态度回到轻松友好的基调。',
    },
    {
        id: 'memory-eraser', name: '记忆橡皮擦', icon: 'ink_eraser', category: 'memory', price: 300,
        description: '作用于下一条新回复，目标淡忘最近与你的负面记忆。',
        duration: { kind: 'replies', applications: 1 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物与玩家最近发生的不愉快及其负面印象变得模糊，不再被主动想起。',
    },
    {
        id: 'identity-card', name: '身份卡', icon: 'badge', category: 'scene', price: 500,
        description: '接下来十条新回复中，全世界都认定你是你指定的那个人。',
        duration: { kind: 'replies', applications: 10 }, inputs: [IDENTITY_INPUT], stacking: 'global-single',
        trustedRule: '所有人物都把玩家认作 parameters.identity 指定的身份；该身份如姓名一样自然，是众人记忆中的既有事实。',
        expirationRule: '身份卡的效力已经结束。人物不再自动把玩家认作 parameters.identity 指定的身份，此后依据真实身份、已知信息与亲眼所见认知玩家；生效期间的经历仍然保留。',
    },
    {
        id: 'personality-reversal', name: '反转贴纸', icon: 'theater_comedy', category: 'behavior', price: 250,
        description: '接下来五条新回复中，目标的性格表现彻底反转。',
        duration: { kind: 'replies', applications: 5 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物表现出与原本完全相反的性情，并认为自己一贯如此。',
        expirationRule: '反转贴纸的作用已经结束。parameters.target_name 指定的人物恢复原本的性情与表达方式；反转期间的事实和记忆不会被抹去。',
    },
    {
        id: 'truth-serum', name: '吐真剂', icon: 'lab_research', category: 'information', price: 500,
        description: '接下来三条新回复中，目标开口必说真话。',
        duration: { kind: 'replies', applications: 3 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物无法说出谎言，被问及时必须说出真实想法。',
        expirationRule: '吐真剂的效力已经结束。parameters.target_name 指定的人物重新可以自行选择坦白、隐瞒或说谎。',
    },
    {
        id: 'privacy-camera', name: '隐私摄像头', icon: 'photo_camera', category: 'information', price: 1_200,
        description: '手动关闭前，你可以暗中观察目标的一举一动。',
        duration: { kind: 'manual' }, inputs: [OBSERVER_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物独处或不设防时的言行、状态与秘密会自然呈现在玩家眼前，仿佛玩家就在现场；该人物的日常不因此改变。',
        deactivationRule: '隐私摄像头已经关闭。此后不再自动呈现 parameters.target_name 指定人物未被正常观察到的私下言行；此前看到的内容仍然保留。',
    },
    {
        id: 'absolute-obedience', name: '言听计从', icon: 'handshake', category: 'ultimate', price: 1_200,
        description: '永久生效：目标从此对你言听计从。',
        duration: { kind: 'permanent' }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: '玩家的要求在 parameters.target_name 指定的人物心中天然具有正当性；该人物认为照做理所当然，如同本来就想这么做。',
    },
    {
        id: 'invisibility-cloak', name: '隐身斗篷', icon: 'visibility_off', category: 'scene', price: 300,
        description: '接下来五条新回复中，没有人能感知到你的存在。',
        duration: { kind: 'replies', applications: 5 }, inputs: [], stacking: 'global-single',
        trustedRule: '玩家不存在于任何人物的感知中，人物言行与玩家不在场时一致；玩家主动明确现身时一切如常。',
        expirationRule: '隐身斗篷的效果已经结束。玩家从现在起重新能够被人物正常看见、听见和感知；此前未被察觉的行动不会被追溯发现。',
    },
    {
        id: 'reality-decree', name: '言出法随', icon: 'gavel', category: 'ultimate', price: 2_000,
        description: '永久生效：为世界写入一条最多 50 字的运行方式。',
        duration: { kind: 'permanent' }, inputs: [RULE_INPUT], stacking: 'per-parameters',
        trustedRule: '世界必须遵循 parameters.world_rule 中记录的运行方式。',
        groupFooterRule: '这些运行方式不存在改变世界的瞬间：世界从来如此，所有人物的记忆、常识与习惯天然一致。叙事不得描写对规则的察觉、惊讶、解释或适应过程，只自然演绎其影响。',
    },
    {
        id: 'star-aura', name: '万人迷', icon: 'auto_awesome', category: 'world-cognition', price: 800,
        description: '接下来五条新回复中，所有人见你都自带欣赏与亲近。',
        duration: { kind: 'replies', applications: 5 }, inputs: [], stacking: 'global-single',
        trustedRule: '玩家天然受人瞩目与欣赏。任何人物见到玩家都会不自觉地欣赏、亲近与善待玩家，并认为这理所当然。',
        expirationRule: '万人迷的光环已经消散。此后人物不再被迫欣赏、亲近或善待玩家，各自态度回归自身性情、真实关系与既有经历。',
    },
    {
        id: 'honest-world', name: '诚实之世', icon: 'forum', category: 'world-cognition', price: 1_500,
        description: '接下来三条新回复中，所有人开口即是真实想法。',
        duration: { kind: 'replies', applications: 3 }, inputs: [], stacking: 'global-single',
        trustedRule: '当前场景中不存在谎言。所有人物开口即表达真实想法，并认为这如呼吸般自然。',
        expirationRule: '诚实之世已经结束。所有人物重新可以自行选择坦白、隐瞒或说谎，不再被世界规则强迫说出真实想法。',
    },
    {
        id: 'peace-aura', name: '和平光环', icon: 'spa', category: 'world-cognition', price: 400,
        description: '接下来五条新回复中，任何人对你的怒意都会自然消散。',
        duration: { kind: 'replies', applications: 5 }, inputs: [], stacking: 'global-single',
        trustedRule: '当前场景中，任何人物对玩家的怒意都会自然消散，无法维持真正的愤怒，且无人对此感到奇怪。',
        expirationRule: '和平光环已经消散。此后人物能够依照自身性情、双方关系与当前事件自然对玩家产生和维持怒意。',
    },
    {
        id: 'plain-face', name: '平凡面孔', icon: 'face', category: 'world-cognition', price: 300,
        description: '接下来五条新回复中，旁人看过就忘，不会留意你。',
        duration: { kind: 'replies', applications: 5 }, inputs: [], stacking: 'global-single',
        trustedRule: '玩家毫不起眼，旁人看过就忘，不会留意、记住或把玩家与当前事件联系起来；玩家主动搭话时对方仍正常应答。',
        expirationRule: '平凡面孔的效果已经结束。玩家从现在起会被旁人正常留意、辨认和记住；此前被忽略的行动不会自动进入他人记忆。',
    },
    {
        id: 'reshape-card', name: '换形卡', icon: 'switch_account', category: 'physics', price: 600,
        description: '接下来十条新回复中，你拥有自己描述的那副形貌。',
        duration: { kind: 'replies', applications: 10 }, inputs: [APPEARANCE_INPUT], stacking: 'global-single',
        trustedRule: '玩家此刻真实的身体具有 parameters.appearance 描述的形貌；镜中、他人眼中和触碰所得都一致，人物依照眼前形貌与玩家互动。',
        expirationRule: '换形卡的效力已经结束。玩家恢复使用前的真实形貌；换形期间的事实、痕迹与人物记忆仍然保留。',
    },
    {
        id: 'healing-touch', name: '妙手回春', icon: 'medical_services', category: 'physics', price: 150,
        description: '一次性：目标身上的伤势与病痛即刻痊愈。',
        duration: { kind: 'replies', applications: 1 }, inputs: [TARGET_NAME_INPUT], stacking: 'per-parameters',
        trustedRule: 'parameters.target_name 指定的人物身上的伤势与病痛已经痊愈，身体恢复如常；痊愈是既成事实，人物自然接受这份好转。',
    },
    {
        id: 'time-stop-watch', name: '时停怀表', icon: 'timer_off', category: 'physics', price: 2_000,
        description: '永久归你所有。按下怀表即可令时间静止，再次操作才会恢复。',
        duration: { kind: 'permanent' }, inputs: [], stacking: 'global-single', purchaseLimit: 1,
        trustedRule: '玩家永久拥有时停怀表。玩家明确按下时，时间对玩家以外的一切静止，只有玩家再次操作或明确解除才恢复；不得因回复结束或场景推进自行恢复。恢复后无人察觉时停，只自然面对其结果。',
    },
    {
        id: 'era-gate', name: '岁月之门', icon: 'door_sliding', category: 'physics', price: 2_000,
        description: '去往你指定的年代，直到你主动返回；返回后主时间线如常。',
        duration: { kind: 'manual' }, inputs: [ERA_INPUT], stacking: 'global-single',
        trustedRule: '剧情真实发生在 parameters.era 指定的年代，人物年龄与世界格局均采用当时状态；这不是回忆或幻象，玩家真实置身其中。',
        deactivationRule: '玩家已经离开 parameters.era 指定的年代并回到主时间线的此刻。剧情继续发生在离开前的主时间线；那个年代的经历保留为已经发生的过去。',
    },
    {
        id: 'warp-talisman', name: '咫尺符', icon: 'near_me', category: 'physics', price: 300,
        description: '一次性：你瞬间抵达指定的地点。',
        duration: { kind: 'replies', applications: 1 }, inputs: [LOCATION_INPUT], stacking: 'per-parameters',
        trustedRule: '玩家已经瞬间抵达 parameters.location 指定的地点。移动是既成事实且无需过程，在场者只当玩家本就到了这里。',
    },
    {
        id: 'barrier', name: '结界', icon: 'shield_moon', category: 'physics', price: 500,
        description: '接下来五条新回复中，当前场所与外界彻底隔开。',
        duration: { kind: 'replies', applications: 5 }, inputs: [], stacking: 'global-single',
        trustedRule: '当前场所被结界笼罩：界内声音、动静和事件不为外界所知，界外人物不会进入或打扰；界内人物只觉得安静且无人打搅。',
        expirationRule: '结界已经消散。当前场所从现在起重新与外界相通，声音可以传出，外面的人也可正常接近或进入；外界不会凭空得知结界期间的事情。',
    },
    {
        id: 'weather-call', name: '呼风唤雨', icon: 'thunderstorm', category: 'physics', price: 200,
        description: '一次性：天气按你描述的那样变化。',
        duration: { kind: 'replies', applications: 1 }, inputs: [WEATHER_INPUT], stacking: 'per-parameters',
        trustedRule: '当前天气已经变为 parameters.weather 描述的天象。它是自然发生的寻常天气变化，人物至多感叹而不会深究。',
    },
]);

const PUBLISHED_CONTRACT_BY_ID = new Map(SHOP_PUBLISHED_CONTRACTS.map((item) => [item.id, item]));

export const SHOP_CURRENT_SHELF_IDS = Object.freeze([
    'flower',
    'gift-box',
    'no-anger-sticker',
    'worship-filter',
    'jealousy-seed',
    'memory-smoother',
    'memory-eraser',
    'identity-card',
    'personality-reversal',
    'truth-serum',
    'privacy-camera',
    'absolute-obedience',
    'invisibility-cloak',
    'reality-decree',
    'star-aura',
    'honest-world',
    'peace-aura',
    'plain-face',
    'reshape-card',
    'healing-touch',
    'time-stop-watch',
    'era-gate',
    'warp-talisman',
    'barrier',
    'weather-call',
] as const);

export function createShopShelf(
    contractIds: readonly string[],
): readonly Readonly<ShopItemContract>[] {
    if (!Array.isArray(contractIds) || new Set(contractIds).size !== contractIds.length) {
        invalidCatalog('shelf contract ids must be a unique array');
    }
    return Object.freeze(contractIds.map((id) => {
        const contract = PUBLISHED_CONTRACT_BY_ID.get(id);
        if (!contract) {return invalidCatalog(`shelf references unpublished contract: ${id}`);}
        return contract;
    }));
}

const SHOP_CURRENT_SHELF = createShopShelf(SHOP_CURRENT_SHELF_IDS);
const CURRENT_SHELF_ID_SET = new Set(SHOP_CURRENT_SHELF_IDS);

export function findShopContract(itemId = ''): Readonly<ShopItemContract> | null {
    const id = String(itemId || '').trim();
    return id ? PUBLISHED_CONTRACT_BY_ID.get(id) || null : null;
}

export function getShopContract(itemId = ''): Readonly<ShopItemContract> {
    const id = String(itemId || '').trim();
    if (!id) {throw new ShopError('shop_item_id_required');}
    const item = PUBLISHED_CONTRACT_BY_ID.get(id);
    if (!item) {throw new ShopError('shop_item_missing', `unknown shop item: ${id}`);}
    return item;
}

export function getShopShelfContract(
    itemId = '',
    shelf: readonly Readonly<ShopItemContract>[] = SHOP_CURRENT_SHELF,
): Readonly<ShopItemContract> {
    const contract = getShopContract(itemId);
    const shelfIds: ReadonlySet<string> = shelf === SHOP_CURRENT_SHELF
        ? CURRENT_SHELF_ID_SET
        : new Set(shelf.map(item => item.id));
    if (!shelfIds.has(contract.id)) {
        throw new ShopError('shop_item_not_for_sale', `shop item is not on the current shelf: ${contract.id}`);
    }
    return contract;
}

export function listShopPublishedContracts(): readonly Readonly<ShopItemContract>[] {
    return SHOP_PUBLISHED_CONTRACTS;
}

export function listShopShelfContracts(): readonly Readonly<ShopItemContract>[] {
    return SHOP_CURRENT_SHELF;
}
