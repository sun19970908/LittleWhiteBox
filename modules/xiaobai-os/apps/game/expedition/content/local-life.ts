import type { Point } from '../types.js';
import type { CourtyardScene } from './world-types.js';

export interface LocalStop { position: Point; wait: number; facing: number }
export interface LocalResident {
    id: string;
    activity: 'mend' | 'warm' | 'dressings' | 'cook' | 'water' | 'deliver';
    coat: 'blue' | 'rose' | 'cream';
    route: readonly LocalStop[];
    phase: number;
}
const stop = (x: number, y: number, wait: number, facing = Math.PI): LocalStop => ({ position: { x, y }, wait, facing });

/** Ordinary life, not conversation participants. Seconds are local scene time; nothing is saved. */
export const LOCAL_LIFE: Partial<Record<CourtyardScene, readonly LocalResident[]>> = {
    camp: [
        { id: 'mender', activity: 'mend', coat: 'rose', phase: 0, route: [stop(-12, 23.2, 0)] },
        { id: 'patient', activity: 'warm', coat: 'blue', phase: 1.3, route: [stop(-21, 12.5, 0, -.4)] },
        { id: 'helper', activity: 'dressings', coat: 'cream', phase: 2.7, route: [stop(-24, 11.9, 0, -.8)] },
        { id: 'stove-tender', activity: 'cook', coat: 'blue', phase: .7, route: [stop(-2.8, 6, 0, Math.PI / 2)] },
        { id: 'water-carrier', activity: 'water', coat: 'cream', phase: 3,
            route: [stop(-31, 18, 6, -Math.PI / 2), stop(-27, 16, 0), stop(-23, 13, 7, Math.PI), stop(-27, 16, 0)] },
        { id: 'delivery', activity: 'deliver', coat: 'rose', phase: 12,
            route: [stop(10, 7, 6), stop(5, 10, 0), stop(-8, 13, 0), stop(-18, 14, 8, Math.PI), stop(-8, 13, 0), stop(5, 10, 0)] },
    ],
};
