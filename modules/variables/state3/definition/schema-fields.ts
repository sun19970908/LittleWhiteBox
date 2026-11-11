import type { ErrorObject } from 'ajv';
import type { ParameterIssue, Path, Schema } from '../types.js';

export const pointerPath = (pointer: string): Path => pointer.split('/').slice(1).map(key => key.replaceAll('~1', '/').replaceAll('~0', '~'));
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Resolve field metadata, not validation: ambiguous schemas keep their literal path label. */
export function schemaField(schema: Schema, path: Path): Record<string, unknown> | undefined {
    function resolve(value: unknown): Record<string, unknown> | undefined {
        if (!object(value)) {return;}
        const seen = new Set<string>();
        let result = value;
        while (typeof result.$ref === 'string' && result.$ref.startsWith('#/')) {
            if (seen.has(result.$ref)) {return result;}
            seen.add(result.$ref);
            let target: unknown = schema;
            for (const key of pointerPath(result.$ref.slice(1))) {target = object(target) ? target[key] : undefined;}
            if (!object(target)) {return result;}
            const { $ref: _reference, ...siblings } = result;
            result = { ...target, ...siblings };
        }
        return result;
    }
    let current = resolve(schema);
    for (const key of path) {
        if (!current) {return;}
        const child = object(current.properties) && Object.hasOwn(current.properties, key) ? current.properties[key]
            : current.type === 'array' ? (Array.isArray(current.items) ? current.items[Number(key)] : current.items)
                : current.additionalProperties;
        current = resolve(child);
    }
    return current;
}

export function fieldName(schema: Schema, path: Path): string {
    const title = schemaField(schema, path)?.title;
    return typeof title === 'string' && title ? title : path.join(' → ');
}

export function parameterIssues(schema: Schema, errors: ErrorObject[]): ParameterIssue[] {
    return errors.map(error => {
        const path = pointerPath(error.instancePath);
        if (error.keyword === 'required') {path.push(String(error.params.missingProperty));}
        if (error.keyword === 'additionalProperties') {path.push(String(error.params.additionalProperty));}
        return { keyword: error.keyword, path, name: fieldName(schema, path), params: structuredClone(error.params) };
    });
}
