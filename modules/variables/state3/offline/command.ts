import { parseArgs } from 'node:util';
import { compileDefinition } from '../definition/compile.js';
import { checkOpenings, initialize, settle } from '../engine/settle.js';
import { equipmentExample } from '../definition/example.js';
import { diagnostic } from '../engine/diagnostics.js';
import { CARD_EXTENSION, FORMAT, definitionSchema } from '../definition/format.js';
import type { Json, RunOptions } from '../types.js';
import { packCard, readBundle, readJson, writeDirectory } from './files.js';
import { OFFLINE_COPY as C } from './copy.js';

export async function runCommand(args: string[]) {
    try {
        const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
            help: { type: 'boolean' }, state: { type: 'string' }, prepared: { type: 'string' }, opening: { type: 'string' }, stage: { type: 'string' },
        } });
        if (values.help || !args.length) {return { ok: true, help: C.help };}
        const [command, source, argument, output] = positionals;
        const counts: Record<string, number> = { schema: 1, init: 2, check: 2, try: 3, pack: 4, unpack: 3 };
        if (positionals.length !== counts[command] || (command !== 'try' && Object.keys(values).length)) {throw new Error(C.arguments);}
        if (command === 'schema') {return { ok: true, format: FORMAT, cardExtension: CARD_EXTENSION, definition: definitionSchema };}
        if (command === 'init') {
            const bundle = equipmentExample();
            await writeDirectory(source, bundle, { spec: 'chara_card_v2', spec_version: '2.0', data: {
                name: bundle.definition.name, description: '', personality: '', scenario: '', first_mes: '', mes_example: '',
                creator_notes: '', system_prompt: '', post_history_instructions: '', alternate_greetings: [], tags: [],
                creator: '', character_version: '1.0', extensions: {},
            } });
            return { ok: true, output: source };
        }
        const compiled = compileDefinition(await readBundle(source));
        if (command === 'try') {
            if (values.stage !== undefined && values.stage !== 'before' && values.stage !== 'after') {throw new Error(C.stage);}
            const opening = values.opening === undefined ? undefined : Number(values.opening);
            if (opening !== undefined && (!Number.isSafeInteger(opening) || opening < 0 || values.opening?.trim() === '')) {throw new Error(C.opening);}
            const options: RunOptions = { stage: values.stage, prepared: values.prepared ? await readJson(values.prepared) as Json : undefined };
            const initial = values.state ? { ok: true as const, state: await readJson(values.state) as Json } : await initialize(compiled, { opening });
            return initial.ok ? await settle(compiled, initial.state, await readJson(argument), options) : initial;
        }
        if (command === 'unpack') {
            await writeDirectory(argument, compiled.bundle);
            return { ok: true, output: argument };
        }
        const checked = await checkOpenings(compiled);
        if (!checked.ok || command === 'check') {return checked;}
        await packCard(argument, output, compiled.bundle);
        return { ok: true, output };
    } catch (error) {return { ok: false, diagnostics: [diagnostic(error)] };}
}
