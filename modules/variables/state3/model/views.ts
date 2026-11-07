import type { Compiled, Definition, Json, Path, Success } from '../types.js';
import { reject } from '../engine/diagnostics.js';
import { clone, getAt, overlaps } from '../engine/data.js';
import { getWritableFields } from './tools.js';
import { readsOf } from '../engine/expressions.js';

const valueAt = (state: Json, path: Path) => {
    const value = getAt(state, path);
    return { path: clone(path), present: value !== undefined, ...(value === undefined ? {} : { value: clone(value) }) };
};
const authoredRules = (definition: Definition) => definition.rules.map(({ id, kind, path, description }) => ({ id, kind, path: clone(path), description }));
const authoredConstraints = (definition: Definition) => definition.constraints.map(({ id, description }) => ({ id, description }));

export function buildRoleplayView(compiled: Compiled, state: Json, { sections, result }: { sections?: string[]; result?: Success } = {}) {
    const definition = compiled.definition;
    const selected = sections === undefined ? Object.keys(definition.views) : sections;
    if (!Array.isArray(selected) || selected.some(id => !Object.hasOwn(definition.views, id))) {
        reject('view-selection');
    }
    const paths = selected.flatMap(id => definition.views[id].paths);
    const relevant = (path: Path) => paths.some(selectedPath => overlaps(selectedPath, path));
    return { name: definition.name,
        sections: selected.map(id => ({ id, description: definition.views[id].description,
            values: definition.views[id].paths.map(path => valueAt(state, path)) })),
        fields: definition.access.filter(entry => relevant(entry.path)).map(({ path, description }) => ({ path: clone(path), description })),
        rules: authoredRules(definition).filter(rule => relevant(rule.path)),
        actions: definition.actions.filter(action => action.effects.some(effect => relevant(effect.path)))
            .map(({ id, description }) => ({ id, description })),
        constraints: definition.constraints.filter(rule => readsOf(rule.test, definition).some(relevant))
            .map(({ id, description }) => ({ id, description })),
        ...(result?.committed === true ? { result: { committed: true, changes: clone(result.changes || []),
            provenance: clone(result.provenance || []), actions: clone(result.actions || []) } } : {}),
    };
}

export function buildUpdateView(compiled: Compiled, state: Json) {
    const definition = compiled.definition, { fields, diagnostics } = getWritableFields(compiled);
    return { name: definition.name, state: clone(state), schema: clone(definition.schema),
        writable: fields.map(({ path, descriptions, schema, removable }) => ({ ...valueAt(state, path), descriptions, schema, removable })),
        actions: definition.actions.map(({ id, description, parameters }) => ({ id, description, parameters: clone(parameters) })),
        fields: definition.access.map(({ path, write, description }) => ({ ...valueAt(state, path), write: clone(write), description })),
        triggers: (definition.triggers || []).map(({ id, description, timing }) => ({ id, description, timing: timing || 'batch' })),
        rules: authoredRules(definition), constraints: authoredConstraints(definition),
        functions: Object.entries(definition.functions).map(([id, fn]) => ({ id, description: fn.description })),
        diagnostics,
    };
}
