import { CARD_FIELDS, TEXT_FIELDS } from './files.js';

export const CARD_FILES = 'CardFiles';

export const CARD_SKILL = Object.freeze({
    id: 'builtin-card-files', title: '小白X角色卡制作',
    summary: 'Build or edit character cards: organize worldbooks and prompt layers, set constant/keyword activation and insertion order, then add LittleWhiteBox variables, status bars, front ends and loop tasks as needed; write back through CardFiles.',
    path: 'modules/card-workspace/skill/SKILL.md',
    tools: [CARD_FILES],
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
variables/definition.json and variables/functions/<name>.js hold the variable 3.0 rule bundle; ReadSkill builtin-state3 describes them.
Card paths keep Chinese, other Unicode names and spaces readable. Reuse paths returned by the tools. Literal percent signs, path separators and control characters inside a name are percent-escaped; the same path works with Read, Write, apply_patch and CardFiles.
New regex/task IDs can be distinct descriptive strings. Existing filenames keep the original IDs. Settings files omit id, uid and the separate body field. Omitted settings preserve saved values. Create both files for a new entry and submit both paths together. Settings and code of an existing entry can also be saved separately.

## Write back and continue
CardFiles save applies only named files and returns one result per file, including saved, unchanged and error. It does not execute task scripts or reset chat variables. Unfinished scripts can be saved. Missing workspace files do not delete card content. A partial failure leaves successful writes in place and failed files editable; retry only the failed files after correcting them.
If the same saved content changed elsewhere, save reports a conflict for that item. Preserve desired local edits, then use refresh with the specific paths to replace those files with saved content before reapplying the edit.

`;

export function cardSkillContent(body, pluginPath) {
    const directory = `${pluginPath}/${CARD_SKILL.path.slice(0, CARD_SKILL.path.lastIndexOf('/'))}`;
    return `${body.trim()}\n\n## Instance source paths\nSkill directory: ${directory}/\nPlugin source root: ${pluginPath}/\nRead these paths with project scope. Relative links resolve from the directory of the document containing them; drop any #anchor before reading the file.\n\n${CARD_FILE_GUIDE}`;
}

export const CARD_TOOL = Object.freeze({ type: 'function', function: {
    name: CARD_FILES,
    description: [
        'Open the current character card as workspace files, write selected files back to the card, or reload selected files from the saved card.',
        'Edit the opened files with Read, Write and apply_patch; ReadSkill builtin-card-files describes the file layout.',
        'open returns {root, avatar, name, paths, reused}; reused is true when an existing workspace copy was kept with its edits.',
        'save returns {ok, results:[{path, saved, unchanged?, hasUnsavedEdits?, error?}]}. unchanged marks a file already equal to the card. hasUnsavedEdits marks a file edited again after the submitted version was saved.',
        'refresh replaces the named workspace files with the saved card content and returns {paths, refreshed:true}.',
    ].join('\n'),
    parameters: { type: 'object', properties: {
        action: { type: 'string', enum: ['open', 'save', 'refresh'] },
        paths: { type: 'array', items: { type: 'string' }, description: 'Exact local workspace file paths. Required for save and refresh; omitted for open. Each save changes only the named files.' },
    }, required: ['action'], additionalProperties: false },
} });
