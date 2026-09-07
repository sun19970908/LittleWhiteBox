import type { GameDieFace } from '../types.js';

/**
 * Pip positions on a 3x3 grid, as [row, column] pairs. Shared by the rolling
 * 3D die and the flat face picker so both read as the same object.
 */
export const GAME_DIE_PIPS: Readonly<Record<GameDieFace, ReadonlyArray<readonly [number, number]>>> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};
