import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

// D1: new installations start in 3.0; existing settings, including pre-selector
// settings, retain their choice (unexpected engine switch / broken existing cards).
test('D1: fresh settings default to 3.0 without migrating existing users', () => {
    const source = readFileSync(new URL('../../../plugin-entry.js', import.meta.url), 'utf8');
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const init = program.body.find(node => node.type === 'ExpressionStatement'
        && node.expression.type === 'AssignmentExpression' && node.expression.left.type === 'MemberExpression'
        && node.expression.left.object.name === 'extension_settings');
    assert.ok(init);
    for (const existing of [undefined, {}, { variablesMode: '1.0' }, { variablesMode: '2.0' }, { variablesMode: '3.0' }]) {
        const extension_settings = existing ? { LittleWhiteBox: existing } : {};
        runInNewContext(source.slice(init.start, init.end), { extension_settings, EXT_ID: 'LittleWhiteBox',
            createDefaultTemplateSettings: () => ({}), createDefaultXiaobaiOsSettings: () => ({}),
        });
        if (existing) {assert.equal(extension_settings.LittleWhiteBox, existing);}
        assert.equal(extension_settings.LittleWhiteBox.variablesMode, existing?.variablesMode ?? (existing ? undefined : '3.0'));
    }
});
