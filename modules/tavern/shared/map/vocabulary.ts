import type { TavernMapTheme, TavernMapStatus } from '../map-state-seed';
import type { TavernMapElementCategory, TavernAtlasLocationScale, TavernAtlasLocationStatus, TavernAtlasLinkKind } from '../structured-state';

export function normalizeAtlasKey(value: unknown = ''): string {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 120);
}

export function normalizeAtlasKeyOrThrow(value: unknown, error: string): string {
    const key = normalizeAtlasKey(value);
    if (!key || /[/\\:*?"<>|\u0000-\u001F]/.test(key) || key === '.' || key === '..') {
        throw new Error(error);
    }
    return key;
}
export type MapIntentShapeKey = 'rect' | 'circle' | 'path' | 'curve' | 'icon' | 'label';

export const MAP_ELEMENT_CATEGORIES = new Set<TavernMapElementCategory>([
    'wall',
    'road',
    'water',
    'terrain',
    'furniture',
    'decoration',
    'door',
    'danger',
    'marker',
    'actor',
    'label',
    'grid',
    'magic',
    'secret',
    'light',
]);
export const MAP_THEMES = new Set<TavernMapTheme>(['parchment', 'paper', 'dark', 'blueprint', 'grid']);
export const MAP_STATUSES = new Set<TavernMapStatus>(['uninitialized', 'active']);
export const ATLAS_LOCATION_SCALES = new Set<TavernAtlasLocationScale>(['city', 'district', 'building', 'floor', 'room', 'outdoor']);
export const ATLAS_LOCATION_STATUSES = new Set<TavernAtlasLocationStatus>(['mentioned', 'visited']);
export const ATLAS_LINK_KINDS = new Set<TavernAtlasLinkKind>(['door', 'stairs', 'elevator', 'path', 'road', 'portal', 'passage']);
export const ATLAS_UNSET_FIELDS = new Set(['parent', 'mapDocId', 'aliases', 'brief']);
export const MAP_INTENT_SHAPES = new Set<MapIntentShapeKey>(['rect', 'circle', 'path', 'curve', 'icon', 'label']);
