import { buildSeedLabelId, isSeedLabelId } from '../map-state-seed';
import type { TavernAtlasDocument, TavernAtlasLocation, TavernMapDocument, TavernMapElement, TavernStateToolResult } from '../structured-state';

export interface MapToolElement {
    id: string;
    cat: TavernMapElement['cat'];
    shape: 'rect' | 'circle' | 'path' | 'curve' | 'icon' | 'label';
    geo: Record<string, unknown>;
    label?: string;
    kind?: TavernMapElement['kind'];
    actorKey?: string;
    material?: TavernMapElement['material'];
    certainty?: TavernMapElement['certainty'];
    closed?: boolean;
}

/** The sole model-facing geometry vocabulary. Storage and replay retain their own coordinates. */
export function mapToolElement(element: TavernMapElement, elements: readonly TavernMapElement[] = []): MapToolElement {
    const [x, y] = element.at;
    const shape = element.rect ? 'rect' : typeof element.circle === 'number' ? 'circle'
        : element.path ? 'path' : element.curve ? 'curve' : element.shape === 'icon' ? 'icon' : element.text !== undefined ? 'label' : 'icon';
    const geo = element.rect ? { center: [x + element.rect[0] / 2, y + element.rect[1] / 2], size: [...element.rect] }
        : typeof element.circle === 'number' ? { at: [x, y], radius: element.circle }
            : element.path ? { points: element.path.map(([px, py]) => [x + px, y + py]) }
                : element.curve ? { curve: element.curve.map(([px, py]) => [x + px, y + py]) }
                    : { at: [x, y], ...(element.icon ? { icon: element.icon } : {}) };
    const label = element.text ?? elements.find(item => item.id === buildSeedLabelId(element.id))?.text;
    return {
        id: element.id, cat: element.cat, shape, geo,
        ...(label === undefined ? {} : { label }),
        ...(element.kind ? { kind: element.kind } : {}),
        ...(element.actorKey ? { actorKey: element.actorKey } : {}),
        ...(element.material ? { material: element.material } : {}),
        ...(element.certainty ? { certainty: element.certainty } : {}),
        ...(element.closed === undefined ? {} : { closed: element.closed }),
    };
}

export function mapToolElements(elements: readonly TavernMapElement[]): MapToolElement[] {
    return elements.filter(item => !isSeedLabelId(item.id)).map(item => mapToolElement(item, elements));
}

/** Read pages count semantic elements, with their attached names, not renderer-generated labels. */
export function sceneReadElements(elements: readonly TavernMapElement[]): TavernMapElement[] {
    return elements.filter(item => !isSeedLabelId(item.id)).map(item => {
        const label = elements.find(candidate => candidate.id === buildSeedLabelId(item.id))?.text;
        return { ...structuredClone(item), ...(label === undefined ? {} : { text: label }) };
    });
}

export function atlasToolLocation(location: TavernAtlasLocation) {
    const { mapDocId, ...facts } = location;
    return { ...structuredClone(facts), hasScene: !!mapDocId };
}

export function atlasToolDocument(document: TavernAtlasDocument) {
    return { ...structuredClone(document), locations: document.locations.map(atlasToolLocation) };
}

export function mapIntentErrorHint(error: string): string {
    const code = error.split(':')[0];
    if (code === 'map_element_rect_invalid') {return 'Use shape rect with geo.center:[x,y] and geo.size:[positiveWidth,positiveHeight].';}
    if (code === 'map_element_radius_required') {return 'Use shape circle with geo.at:[x,y] and positive geo.radius.';}
    if (code === 'map_element_at_required') {return 'Supply geo.center for a rectangle, or geo.at for a circle, icon or label.';}
    if (code === 'map_element_points_required') {return 'Supply at least two absolute points in geo.points for path, or geo.curve for curve.';}
    if (code === 'map_element_text_required') {return 'A label needs nonempty label text and geo.at:[x,y].';}
    return 'Correct only this element using the declared shape/geo fields. Read the existing scene when its identity or geometry is uncertain.';
}

/** One projection for both ordinary tool messages and stateful provider continuations. */
export function projectMapToolResult(name: string, args: Record<string, unknown>, result: TavernStateToolResult): Record<string, unknown> {
    const output: Record<string, unknown> = {
        ok: result.ok, changed: result.changed,
        summary: result.ok ? args.dryRun === true ? `${name} validated only; nothing saved.` : `${name} succeeded${result.changed === false ? '; unchanged is success' : ''}.` : `${name} failed; nothing saved.`,
        ...(args.dryRun === true ? { dryRun: true } : {}),
        ...(result.revision === undefined ? {} : { revision: result.revision }),
    };
    for (const key of ['count', 'truncated', 'nextOffset', 'elementCount', 'warnings', 'activeLocationKey'] as const) {
        if (result[key] !== undefined) {output[key] = structuredClone(result[key]);}
    }
    if (result.error) {output.error = result.error;}
    if (result.failed) {output.failed = result.failed.map(item => ({ index: item.index, error: item.error }));}
    if (result.applied) {output.applied = result.applied.map(({ op: _op, ...item }) => item);}
    if (result.skipped) {output.skipped = result.skipped.map(item => ({ ...item, hint: mapIntentErrorHint(String(item.reason || '')) }));}
    if (name === 'MapSceneRead' || name === 'MapSceneEdit') {
        const scene = result.scene || String(args.scene || '');
        output.scene = scene;
        if (result.meta) {output.meta = structuredClone(result.meta);}
        if (result.document) {
            const document = result.document as TavernMapDocument;
            output.document = {
                scene, title: result.title || document.meta.name || scene,
                ...(document.meta.viewBox ? { viewBox: [...document.meta.viewBox] } : {}),
                ...(document.meta.mood ? { mood: document.meta.mood } : {}),
                theme: document.meta.theme,
                elements: mapToolElements(document.elements),
            };
        }
        if (result.elements) {output.elements = mapToolElements(result.elements);}
        if (result.element) {output.element = mapToolElement(result.element);}
    } else {
        if (result.details && args.mode !== 'document') {
            const { locationCount, linkCount, actorCount } = result.details as Record<string, unknown>;
            if (locationCount !== undefined) {output.counts = { locations: locationCount, links: linkCount, actors: actorCount };}
        }
        if (result.document) {output.document = atlasToolDocument(result.document as TavernAtlasDocument);}
        if (result.locations) {output.locations = result.locations.map(atlasToolLocation);}
        if (result.links) {output.links = structuredClone(result.links);}
        if (result.actors) {output.actors = structuredClone(result.actors);}
    }
    return output;
}
