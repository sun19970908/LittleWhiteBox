import type { MapAtlas, MapLocation } from './types.js';

export function isMapRegion(location: MapLocation): boolean {
    return location.scale === 'region';
}

export function isMapSceneLocation(location: MapLocation): boolean {
    return location.scale !== 'world' && !isMapRegion(location);
}

/** The atlas has already passed reference and cycle validation. */
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

export function locationRegion(atlas: MapAtlas, key: string): MapLocation | undefined {
    return locationTrail(atlas, key).reverse().find(isMapRegion);
}

/** Missing geography is kept intact on read and completed through Atlas edits. */
export function unassignedMapLocations(atlas: MapAtlas): MapLocation[] {
    return atlas.locations.filter(location => isMapSceneLocation(location) && !locationRegion(atlas, location.key));
}

/** A visit to a place also establishes a visit to its containing locations. This is a read projection. */
export function visitedMapLocationKeys(atlas: MapAtlas): ReadonlySet<string> {
    const visited = new Set<string>();
    const playerKey = atlas.actors.find(actor => actor.actorKey === 'player')?.locationKey;
    for (const location of atlas.locations) {
        if (location.status !== 'visited' && location.key !== playerKey) {continue;}
        for (const ancestor of locationTrail(atlas, location.key)) {visited.add(ancestor.key);}
    }
    return visited;
}
