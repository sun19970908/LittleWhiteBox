import { CARD_FIELDS, TEXT_FIELDS } from './files.js';

export const CARD_SKILL = Object.freeze({
    id: 'builtin-card-files', title: '小白X角色卡制作',
    summary: '制作或修改角色卡：组织世界书与提示词层次、配置蓝绿灯和插入顺序，再按需制作小白X变量、状态栏、前端与循环任务；通过角色卡文件写回。',
    path: 'modules/card-workspace/skill/SKILL.md',
});

// Field names are derived from the same projection used by CardFiles.
const CARD_FILE_GUIDE = `# Character card files

## The card and its working copy
CardFiles open returns the selected card's root, avatar, name and file paths. An existing folder is reused with its edits intact. The Assistant workspace persists across conversations and reloads. Workspace edits become live card changes only through CardFiles save.

## Edit files
Read and search with scope local. Write creates files; apply_patch changes parts of existing files. The same files are editable in the workspace UI, with original/current/diff views and a writeback button. Save receives file paths, not file contents. Work in the root returned by open.

## File locations
card.json contains ${CARD_FIELDS.join(', ')} and world (the primary linked lorebook name). Other extensions remain on the card untouched.
${TEXT_FIELDS.map(key => `${key}.md`).join(', ')} map to the corresponding card fields.
message/0.md is the first greeting. Consecutive numbers starting at 1 are alternate greetings. Append at the next number to add a greeting.
world_book/<book-name>/<numeric-uid>.json contains entry settings; the matching .md contains its content. A new book is created when its first entry is saved. Set world in card.json to link a primary book. Existing shared lorebook edits affect its other users too.
regex/<id>.json contains scoped regex settings; the matching .html contains replaceString.
tasks/<id>.json contains LittleWhiteBox task settings; the matching .js contains the complete commands, including taskjs wrappers when used.
Card paths keep Chinese, other Unicode names and spaces readable. Reuse paths returned by the tools. Literal percent signs, path separators and control characters inside a name are percent-escaped; the same path works with Read, Write, apply_patch and CardFiles.
New regex/task IDs can be distinct descriptive strings. Existing filenames keep the original IDs. Settings files omit id, uid and the separate body field. Omitted settings preserve saved values. Create both files for a new entry and submit both paths together. Settings and code of an existing entry can also be saved separately.

## Write back and continue
CardFiles save applies only named files and returns one result per file, including saved, unchanged and error. It does not execute task scripts or reset chat variables. Unfinished scripts can be saved. Missing workspace files do not delete card content. A partial failure leaves successful writes in place and failed files editable; retry only the failed files after correcting them.
If the same saved content changed elsewhere, save reports a conflict for that item. Preserve desired local edits, then use refresh with the specific paths to replace those files with saved content before reapplying the edit.

`;

export function cardSkillContent(body, pluginPath) {
    const directory = `${pluginPath}/${CARD_SKILL.path.slice(0, CARD_SKILL.path.lastIndexOf('/'))}`;
    return `${body.trim()}\n\n## 本实例的资料位置\n本技能目录：${directory}/\n插件目录：${pluginPath}/\n用 Read 的 project scope 读取资料；相对链接按所在文档的目录解析，去掉 # 后的章节锚点后读取文件。\n\n${CARD_FILE_GUIDE}`;
}

export const CARD_TOOL = Object.freeze({ type: 'function', function: {
    name: 'CardFiles',
    description: 'Open the current character card as workspace files, write selected files back, or refresh selected files from saved content. open returns {root, avatar, name, paths, reused}; reused means existing workspace edits were preserved. save returns {ok, results:[{path, saved, unchanged?, hasUnsavedEdits?, error?}]}; unchanged is a successful no-op; hasUnsavedEdits means later workspace edits remain after the submitted version was saved. refresh replaces the specified workspace files and returns {paths, refreshed:true}. Use Read/Write/apply_patch to edit files; use ReadSkill builtin-card-files for the file layout. Saving is independent of variable management being enabled.',
    parameters: { type: 'object', properties: {
        action: { type: 'string', enum: ['open', 'save', 'refresh'] },
        paths: { type: 'array', items: { type: 'string' }, description: 'Exact local workspace file paths. Required for save and refresh; omitted for open. Each save changes only the named files.' },
    }, required: ['action'], additionalProperties: false },
} });
