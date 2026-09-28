export function calcAtomQuality(scene, edges, where) {
    const sceneScore = Math.min(String(scene || '').length / 80, 1);
    const edgeScore = Math.min((edges?.length || 0) / 3, 1);
    return Number((0.55 * sceneScore + 0.35 * edgeScore + 0.10 * (where ? 1 : 0)).toFixed(3));
}
