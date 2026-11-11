export const COPY = Object.freeze({
    title: '编辑角色卡', open: '打开角色卡文件', save: '写回角色卡', saved: '已写回角色卡',
    savedLater: '已写回点击时的内容，之后的编辑仍在工作区',
    noCard: '请先打开一张角色卡', changedCard: '当前角色卡已切换，请回到对应角色卡后写回',
    conflict: '这项内容已在酒馆中改过，未覆盖。重新读取这个文件后再修改。',
    missing: '工作区中没有这个文件', unsupported: '这个文件没有对应的角色卡写回位置',
    invalidObject: '设置文件需要是 JSON 对象', identity: '条目标识由文件路径决定，设置文件不填写 id、uid 或正文',
    greetingGap: '新开场白请接在现有序号之后', unconfirmed: '未能确认写回结果，请重新读取酒馆中的内容',
    noFiles: '请指定要写回的文件', unsupportedSetting: 'card.json 只编辑名称、标签、作者、版本和主世界书，正文与条目请编辑对应文件',
    help: '文件在工作区编辑，写回后才修改角色卡。',
    failed: '部分文件未写回', unchanged: '内容没有变化',
});
