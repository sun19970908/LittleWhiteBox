import type {
    MapElementCategory,
    MapElementKind,
    MapElementShape,
    MapIconToken,
    MapMaterial,
} from './types.js';

export const MAP_ELEMENT_CATEGORIES: readonly MapElementCategory[] = Object.freeze([
    'wall', 'road', 'water', 'terrain', 'furniture', 'decoration', 'door', 'danger', 'marker',
    'actor', 'label', 'grid', 'magic', 'secret', 'light',
]);

export const MAP_ELEMENT_SHAPES: readonly MapElementShape[] = Object.freeze([
    'rect', 'circle', 'path', 'curve', 'icon', 'label',
]);

export const MAP_ELEMENT_KINDS: readonly MapElementKind[] = Object.freeze([
    'door', 'stairs', 'elevator', 'portal', 'passage', 'entrance', 'exit', 'north', 'south',
    'east', 'west', 'up', 'down', 'trap', 'chest', 'marker', 'player', 'actor',
]);

export const MAP_MATERIALS: readonly MapMaterial[] = Object.freeze([
    'unknown', 'wood', 'stone', 'tile', 'carpet', 'bed-sheet', 'fabric', 'tatami', 'sand',
    'marble', 'blood', 'water', 'grass', 'forest', 'glass', 'dirt', 'snow', 'metal', 'rune', 'warm-light',
    'cold-light', 'shadow',
]);

export const MAP_CERTAINTIES = Object.freeze(['confirmed', 'inferred', 'unknown'] as const);

export const MAP_ICON_TOKENS: readonly MapIconToken[] = Object.freeze([
    'door-open', 'stairs', 'elevator', 'portal', 'passage', 'entrance', 'exit', 'north', 'south',
    'east', 'west', 'up', 'down', 'trap', 'chest', 'marker', 'player', 'actor', 'chair', 'table',
    'bed', 'counter', 'shelf', 'sofa', 'bridge', 'tree', 'rock', 'building', 'fire', 'light', 'water',
]);

export const MAP_TERRAIN_CATEGORY_ALIASES = Object.freeze(new Set([
    'floor', 'ground', 'surface', 'base', 'area', 'deck', 'platform', 'walkway', 'clearing', 'yard',
]));
