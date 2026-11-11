import { getContext } from '../../../../../../../extensions.js';
import type { Compiled } from '../types.js';
import * as hostMacros from '../../../../../../../macros.js';
import { buildDescriptionView } from './views.js';
const { MacrosParser } = hostMacros as unknown as { MacrosParser: {
    registerMacro(name: string, value: () => string, description: string): void;
    unregisterMacro(name: string): void;
} };

export function createState3Macros() {
    const names = new Set<string>();
    let unregister: (name: string) => void = name => MacrosParser.unregisterMacro(name);
    function clear() {
        for (const name of names) {unregister(name);}
        names.clear();
    }
    return {
        set(compiled: Compiled) {
            clear();
            const ctx = getContext() as unknown as { powerUserSettings?: { experimental_macro_engine?: boolean }; macros?: {
                register(name: string, options: { unnamedArgs: { name: string; optional: boolean }[]; handler(ctx: { args: string[] }): string; description: string }): void;
                registry: { unregisterMacro(name: string): void };
            } };
            // ST 1.18 optional macro engine accepts arguments; ST 1.14 uses literal registered keys.
            if (ctx.powerUserSettings?.experimental_macro_engine && ctx.macros) {
                const registry = ctx.macros;
                unregister = name => registry.registry.unregisterMacro(name);
                names.add('xbvardesc');
                registry.register('xbvardesc', { unnamedArgs: [{ name: 'section', optional: true }],
                    description: compiled.definition.name,
                    handler: ({ args }) => JSON.stringify(buildDescriptionView(compiled, args[0] ? [args[0]] : undefined)) });
                return;
            }
            unregister = name => MacrosParser.unregisterMacro(name);
            const register = (name: string, sections?: string[]) => {
                names.add(name);
                MacrosParser.registerMacro(name, () => JSON.stringify(buildDescriptionView(compiled, sections)), compiled.definition.name);
            };
            register('xbvardesc');
            for (const section of Object.keys(compiled.definition.views)) {register(`xbvardesc::${section}`, [section]);}
        },
        clear, dispose: clear,
    };
}
