import type { Compiled, Definition, Json } from '../types.js';
import { reject } from '../engine/diagnostics.js';
import { clone, overlaps } from '../engine/data.js';
import { getWritableFields } from './tools.js';

const authoredRules = (definition: Definition) => definition.rules.map(({ id, kind, path, description }) => ({ id, kind, path: clone(path), description }));
const authoredConstraints = (definition: Definition) => definition.constraints.map(({ id, description }) => ({ id, description }));

export function buildDescriptionView(compiled: Compiled, sections = Object.keys(compiled.definition.views)) {
    const definition = compiled.definition;
    if (sections.some(id => !Object.hasOwn(definition.views, id))) {reject('view-selection');}
    const paths = sections.flatMap(id => definition.views[id].paths);
    return { name: definition.name,
        sections: sections.map(id => ({ id, description: definition.views[id].description, paths: clone(definition.views[id].paths) })),
        fields: definition.access.filter(entry => paths.some(path => overlaps(path, entry.path)))
            .map(({ path, description }) => ({ path: clone(path), description })),
    };
}

export function buildUpdateView(compiled: Compiled, state: Json) {
    const definition = compiled.definition, fields = getWritableFields(compiled);
    return { name: definition.name, state: clone(state), schema: clone(definition.schema),
        writable: fields.map(({ path, descriptions, removable }) => ({ path: clone(path), descriptions, removable })),
        actions: definition.actions.map(({ id, description, parameters }) => ({ id, description, parameters: clone(parameters) })),
        fields: definition.access.map(({ path, write, description, update }) => ({ path: clone(path), write: clone(write), description, ...(update ? { update } : {}) })),
        triggers: (definition.triggers || []).map(({ id, description, timing }) => ({ id, description, timing: timing || 'batch' })),
        rules: authoredRules(definition), constraints: authoredConstraints(definition),
        functions: Object.entries(definition.functions).map(([id, fn]) => ({ id, description: fn.description })),
    };
}
