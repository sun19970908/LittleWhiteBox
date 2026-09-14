import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three';
import type { MapMaterial } from '../../../../domains/map/types.js';

/** Small, deterministic surface detail; no downloaded assets or scene facts. */
export function createSurfaceTexture(token: MapMaterial, floor: boolean): DataTexture {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    let seed = 781;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const noise = seed / 4294967296;
            let value = .94 + noise * .06;
            if (token === 'wood') {
                const grain = Math.sin(y * .82 + Math.sin(x * Math.PI / 64) * 2 + Math.sin(y * .19));
                value = .89 + grain * .045 + noise * .04;
                if (floor) {
                    const row = Math.floor(y / 32);
                    value += [0, .025, -.02, .012][row];
                    if (y % 32 === 0 || (x + row * 47) % 128 === 0) {value = .69;}
                }
            } else if (token === 'tile') {
                value = x % 64 < 2 || y % 64 < 2 ? .73 : .96 + noise * .04;
            } else if (['fabric', 'carpet', 'bed-sheet', 'tatami'].includes(token)) {
                value = .88 + ((x % 4 < 2) === (y % 4 < 2) ? .07 : 0) + noise * .05;
            } else if (token === 'stone' || token === 'marble') {
                value = .92 + Math.sin(x * .15 + Math.sin(y * .12)) * .025 + noise * .055;
            }
            const channel = Math.round(value * 255);
            pixels.set([channel, channel, channel, 255], (y * size + x) * 4);
        }
    }
    const texture = new DataTexture(pixels, size, size, RGBAFormat);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    if (floor && token === 'wood') {texture.repeat.set(.55, .55);}
    texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}
