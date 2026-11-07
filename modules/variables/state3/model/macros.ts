import type { Compiled, Json, Success } from '../types.js';
export interface MacroSnapshot { compiled: Compiled; state: Json; result?: Success }
import * as hostMacros from '../../../../../../../macros.js';
const { MacrosParser } = hostMacros as unknown as { MacrosParser: {
    registerMacro(name: string, value: () => string, description: string): void;
    unregisterMacro(name: string): void;
} };
import { buildRoleplayView } from './views.js';

// Macros are synchronous host callbacks; only settled snapshots enter this
// run-local projection. Capture overlays never touch chat metadata.
export function createState3Macros() {
    let current: MacroSnapshot | undefined;
    const names = new Set<string>();
    function replace(snapshot?: MacroSnapshot) {
        for (const name of names) {MacrosParser.unregisterMacro(name);}
        names.clear(); current = snapshot;
        if (!snapshot) {return;}
        for (const [section, view] of Object.entries(snapshot.compiled.definition.views)) {
            const name = `lwb3_${section}`; names.add(name);
            MacrosParser.registerMacro(name, () => JSON.stringify(buildRoleplayView(snapshot.compiled, snapshot.state, { sections: [section] })), view.description);
        }
        names.add('lwb3_result');
        MacrosParser.registerMacro('lwb3_result', () => JSON.stringify(buildRoleplayView(snapshot.compiled, snapshot.state,
            { sections: [], result: snapshot.result })), '已确认的最近一次变量结算');
    }
    return {
        set: replace,
        expose(snapshot: MacroSnapshot) {
            const previous = current;
            replace(snapshot);
            return () => { if (current === snapshot) {replace(previous);} };
        },
        clear: () => replace(undefined), dispose: () => replace(undefined),
    };
}
