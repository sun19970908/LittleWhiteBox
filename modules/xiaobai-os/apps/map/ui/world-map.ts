import type { MapAtlas, MapLink, MapLocation } from '../../../domains/map/types.js';

export interface WorldMapNode { location: MapLocation; x: number; y: number; placed: boolean }
export interface WorldMapRoute { link: MapLink; from: WorldMapNode; to: WorldMapNode; path: string; x: number; y: number }

export function locationTrail(atlas: MapAtlas, key: string): MapLocation[] {
    const byKey = new Map(atlas.locations.map(location => [location.key, location]));
    const trail: MapLocation[] = [];
    let location = byKey.get(key);
    while (location) {
        trail.unshift(location);
        location = location.parent ? byKey.get(location.parent) : undefined;
    }
    return trail;
}

export function initialWorldRegion(atlas: MapAtlas): string {
    const roots = atlas.locations.filter(location => !location.parent);
    return roots.length === 1 && atlas.locations.some(location => location.parent === roots[0].key) ? roots[0].key : '';
}

/** A location's representative on this region's map, without changing its real location. */
export function locationInRegion(atlas: MapAtlas, key: string, region: string): string {
    return locationTrail(atlas, key).find(location => (location.parent || '') === region)?.key || '';
}

export function connectedPlaces(atlas: MapAtlas, key: string) {
    return atlas.links.flatMap(link => {
        if (link.from !== key && link.to !== key) {return [];}
        const location = atlas.locations.find(item => item.key === (link.from === key ? link.to : link.from));
        return location ? [{ location, link, outgoing: link.bidirectional || link.from === key }] : [];
    });
}

/** Authored positions are immutable during layout; missing positions get a clearly schematic arrangement. */
export function layoutWorldMap(atlas: MapAtlas, region: string) {
    const locations = atlas.locations.filter(location => (location.parent || '') === region)
        .sort((a, b) => a.key.localeCompare(b.key, 'en'));
    const nodes: WorldMapNode[] = locations.filter(location => location.position)
        .map(location => ({ location, x: location.position![0], y: location.position![1], placed: true }));
    let candidate = 0;
    for (const location of locations.filter(item => !item.position)) {
        let x: number;
        let y: number;
        do {
            const angle = candidate * 2.3999632297;
            const radius = 155 * Math.sqrt(candidate++);
            x = Math.round(500 + Math.cos(angle) * radius);
            y = Math.round(420 + Math.sin(angle) * radius);
        } while (nodes.some(node => Math.hypot(node.x - x, node.y - y) < 160));
        nodes.push({ location, x, y, placed: false });
    }
    nodes.sort((a, b) => a.location.key.localeCompare(b.location.key, 'en'));
    const byKey = new Map(nodes.map(node => [node.location.key, node]));
    const routes: WorldMapRoute[] = atlas.links.flatMap(link => {
        const from = byKey.get(locationInRegion(atlas, link.from, region));
        const to = byKey.get(locationInRegion(atlas, link.to, region));
        if (!from || !to || from === to) {return [];}
        const x = (from.x + to.x) / 2;
        const y = (from.y + to.y) / 2;
        return [{ link, from, to, x, y, path: `M ${from.x} ${from.y} Q ${x + (to.y - from.y) * .12} ${y - (to.x - from.x) * .12} ${to.x} ${to.y}` }];
    });
    const minX = nodes.length ? Math.min(...nodes.map(node => node.x)) - 140 : 0;
    const minY = nodes.length ? Math.min(...nodes.map(node => node.y)) - 150 : 0;
    const width = nodes.length ? Math.max(420, Math.max(...nodes.map(node => node.x)) - minX + 140) : 800;
    const height = nodes.length ? Math.max(500, Math.max(...nodes.map(node => node.y)) - minY + 190) : 900;
    return { nodes, routes, viewBox: [minX, minY, width, height] as [number, number, number, number] };
}
