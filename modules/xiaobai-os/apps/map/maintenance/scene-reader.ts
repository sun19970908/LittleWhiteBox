import type { CircleGeometry, MapElement, MapLocation, MapScene, PointGeometry, PointsGeometry, RectGeometry } from '../../../domains/map/types.js';

function toolGeometry(element: MapElement): Record<string, unknown> {
    switch (element.shape) {
        case 'rect': {
            const { x, y, width, height } = element.geometry as RectGeometry;
            return { center: [x + width / 2, y + height / 2], size: [width, height] };
        }
        case 'circle': {
            const { x, y, radius } = element.geometry as CircleGeometry;
            return { at: [x, y], radius };
        }
        case 'path':
        case 'curve':
            return { [element.shape === 'path' ? 'points' : 'curve']: structuredClone((element.geometry as PointsGeometry).points) };
        case 'icon':
        case 'label': {
            const { x, y } = element.geometry as PointGeometry;
            return { at: [x, y] };
        }
    }
}

/** Read-only wire projection in MapSceneEdit vocabulary; never stored as another scene model. */
export function sceneForTool(scene: MapScene, owner: MapLocation) {
    return {
        scene: owner.key,
        title: owner.name,
        viewBox: [...scene.viewBox],
        ...(scene.mood ? { mood: scene.mood } : {}),
        elements: scene.elements.map(element => {
            const { category, geometry: _geometry, ...facts } = structuredClone(element);
            return { ...facts, cat: category, geo: toolGeometry(element) };
        }),
    };
}
