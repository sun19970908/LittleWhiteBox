function capability(label: string, uses: readonly string[]) {
    return { label, uses, description: uses.join('、') };
}

export const COC7_ATTRIBUTES = {
    body: capability('体魄', ['施力', '耐力', '身体抵抗']),
    mind: capability('心智', ['推理', '记忆', '临场判断']),
    will: capability('意志', ['专注', '决心', '精神抵抗']),
    appearance: capability('外表', ['吸引力', '印象', '影响']),
} as const;
export type Coc7Attribute = keyof typeof COC7_ATTRIBUTES;

export const COC7_SKILLS = {
    athletics: capability('运动', ['攀爬', '游泳', '平衡', '闪避', '骑乘']),
    melee: capability('近战', ['徒手', '近身武器']),
    ranged: capability('远程', ['弓弩', '枪械', '投掷']),
    awareness: capability('侦察', ['观察', '聆听', '搜索']),
    survival: capability('求生', ['辨向', '追踪', '野外生存']),
    medicine: capability('医学', ['急救', '诊断', '治疗']),
    knowledge: capability('学识', ['知识辨识', '资料研究']),
    social: capability('社交', ['交涉', '欺骗', '察言观色']),
    mechanics: capability('机工', ['器具操作', '载具操作', '维修', '锁具']),
    craft: capability('技艺', ['表演', '烹饪', '艺术', '手工']),
    concealment: capability('隐匿', ['潜行', '藏身', '扒窃']),
    intimacy: capability('亲密', ['取悦', '情欲技巧', '身体亲昵']),
} as const;
export type Coc7Skill = keyof typeof COC7_SKILLS;
export const COC7_CAPABILITIES = { ...COC7_ATTRIBUTES, ...COC7_SKILLS } as const;
export type Coc7Stat = keyof typeof COC7_CAPABILITIES;
export const COC7_STAT_IDS = Object.keys(COC7_CAPABILITIES) as Coc7Stat[];
export const COC7_ATTRIBUTE_IDS = Object.keys(COC7_ATTRIBUTES) as Coc7Attribute[];
export const COC7_SKILL_IDS = Object.keys(COC7_SKILLS) as Coc7Skill[];
