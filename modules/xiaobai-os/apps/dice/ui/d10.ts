import { Euler } from 'three/src/math/Euler.js';
import { Matrix4 } from 'three/src/math/Matrix4.js';
import { Quaternion } from 'three/src/math/Quaternion.js';
import { Vector3 } from 'three/src/math/Vector3.js';

const SVG = 'http://www.w3.org/2000/svg';
const LIGHT = new Vector3(-.7, 1, 1.5).normalize();
const HALF_LIGHT = LIGHT.clone().add(new Vector3(0, 0, 1)).normalize();
let nextPaintId = 0;

// A pentagonal trapezohedron: ten planar kite faces, not a flat ten-sided badge.
const poleHeight = 1.12;
const beltHeight = poleHeight * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
const belt = Array.from({ length: 10 }, (_, index) => {
    const angle = index * Math.PI / 5;
    return new Vector3(Math.cos(angle) * .9, Math.sin(angle) * .9, index % 2 ? beltHeight : -beltHeight);
});
const faces = belt.map((tip, index) => {
    const points = [new Vector3(0, 0, index % 2 ? -poleHeight : poleHeight), belt[(index + 9) % 10], tip, belt[(index + 1) % 10]];
    const center = points.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(.25);
    const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    if (normal.dot(center) < 0) { normal.negate(); }
    const up = points[0].clone().sub(center).normalize();
    const right = up.clone().cross(normal).normalize();
    return { points, center, normal, up, right, value: index < 5 ? index : 14 - index,
        inset: points.map(point => point.clone().lerp(center, .12)),
        bevels: points.map((point, edge) => point.clone().add(points[(edge + 1) % 4]).multiplyScalar(.5)
            .sub(center).normalize().multiplyScalar(.6).addScaledVector(normal, .8).normalize()) };
});

function svg<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) { element.setAttribute(key, value); }
    return element;
}
function project(point: Vector3): [number, number] {
    const scale = 53 / (1 - point.z * .1);
    return [80 + point.x * scale, 78 - point.y * scale];
}
function polygon(points: Vector3[]): string { return points.map(point => project(point).join(',')).join(' '); }
function metal(normal: Vector3, rim = false, reflection = 0): string {
    const diffuse = Math.max(0, normal.dot(LIGHT));
    const shine = Math.pow(Math.max(0, normal.dot(HALF_LIGHT)), 14);
    const base = rim ? [68, 83, 99] : [22, 36, 53];
    return `rgb(${base.map(channel => Math.round(Math.min(255, channel + diffuse * (rim ? 130 : 38) + (shine + reflection) * 95))).join(',')})`;
}

/** Rotate fixed, numbered faces to the saved digit. Rendering never samples a roll. */
export function createD10(value: number, place: 'tens' | 'units') {
    if (!Number.isInteger(value) || value < 0 || value > 9) { throw new TypeError('dice_d10_face_invalid'); }
    const face = faces.find(candidate => candidate.value === value)!;
    const rest = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(face.right, face.up, face.normal)).invert();
    const direction = place === 'tens' ? -1 : 1;
    const tilt = new Quaternion().setFromEuler(new Euler(-.08, direction * .13, direction * .09));
    const element = svg('svg', { viewBox: '0 0 160 160', 'aria-hidden': 'true', focusable: 'false' });
    element.classList.add('xb-dice-d10');
    element.dataset.place = place;
    const paintId = `xb-d10-${++nextPaintId}`;
    const definitions = svg('defs');
    const ink = svg('linearGradient', { id: `${paintId}-ink`, x1: '0', y1: '0', x2: '.2', y2: '1' });
    for (const [offset, color] of [['0', '#fff5d6'], ['.45', '#ead4a1'], ['1', '#b99555']]) { ink.append(svg('stop', { offset, 'stop-color': color })); }
    definitions.append(ink);
    const shadow = svg('ellipse', { cx: '80', cy: '142', rx: '36', ry: '5', fill: '#08111b', opacity: '.22' });
    shadow.style.filter = 'blur(3px)';
    const body = svg('g');
    const surfaces = faces.map((source, index) => {
        const group = svg('g');
        const paint = svg('linearGradient', { id: `${paintId}-face-${index}`, gradientUnits: 'userSpaceOnUse' });
        const stops = ['0', '.35', '.5', '.65', '1'].map(offset => svg('stop', { offset }));
        paint.append(...stops); definitions.append(paint);
        const shell = svg('polygon', { 'stroke-width': '.5', 'stroke-linejoin': 'round' });
        const bevels = source.points.map(() => svg('polygon', { 'stroke-width': '.3', 'stroke-linejoin': 'round' }));
        const surface = svg('polygon', { fill: `url(#${paint.id})`, stroke: '#101e2b', 'stroke-width': '.8', 'stroke-linejoin': 'round' });
        const rim = svg('polygon', { fill: 'none', stroke: '#d4e4ef', 'stroke-opacity': '.35', 'stroke-width': '.5' });
        const label = svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-weight': '700', 'font-family': 'Georgia, "Times New Roman", serif', fill: `url(#${ink.id})`, stroke: '#0b131d', 'stroke-width': '.012', 'paint-order': 'stroke fill' });
        label.textContent = place === 'tens' ? String(source.value * 10).padStart(2, '0') : String(source.value);
        group.append(shell, ...bevels, surface, rim, label); body.append(group);
        return { group, shell, bevels, surface, rim, label, paint, stops };
    });
    element.append(definitions, shadow, body);

    function draw(progress: number, revealed = false): void {
        const t = Math.max(0, Math.min(1, progress));
        const remaining = Math.pow(1 - Math.min(1, t / .88), 2.5);
        const rotation = new Quaternion().setFromEuler(new Euler(
            remaining * Math.PI * 4.5,
            direction * remaining * Math.PI * 3.5,
            direction * remaining * .8,
        )).multiply(tilt).multiply(rest);
        const hop = (1 - t) * (5 + Math.abs(Math.sin(t * Math.PI * 3 + direction * .3)) * 15);
        body.setAttribute('transform', `translate(0 ${-hop})`);
        shadow.setAttribute('rx', String(36 - hop / 3));
        shadow.setAttribute('opacity', String(.22 - hop / 180));
        faces.forEach((source, index) => {
            const part = surfaces[index];
            const normal = source.normal.clone().applyQuaternion(rotation);
            part.group.style.display = normal.z > .015 ? '' : 'none';
            if (normal.z <= .015) { return; }
            const center = source.center.clone().applyQuaternion(rotation);
            const visible = source.points.map(point => point.clone().applyQuaternion(rotation));
            const inset = source.inset.map(point => point.clone().applyQuaternion(rotation));
            part.shell.setAttribute('points', polygon(visible));
            part.shell.setAttribute('fill', metal(normal, true));
            part.shell.setAttribute('stroke', metal(normal, true));
            part.surface.setAttribute('points', polygon(inset));
            part.rim.setAttribute('points', polygon(inset.map(point => point.clone().lerp(center, .035))));
            part.bevels.forEach((bevel, edge) => {
                const next = (edge + 1) % 4;
                bevel.setAttribute('points', polygon([visible[edge], visible[next], inset[next], inset[edge]]));
                const color = metal(source.bevels[edge].clone().applyQuaternion(rotation), true);
                bevel.setAttribute('fill', color);
                bevel.setAttribute('stroke', color);
            });
            const origin = project(center);
            part.paint.setAttribute('x1', String(origin[0] - 30));
            part.paint.setAttribute('y1', String(origin[1] - 45));
            part.paint.setAttribute('x2', String(origin[0] + 30));
            part.paint.setAttribute('y2', String(origin[1] + 45));
            const band = .5 + normal.x * .18 - normal.y * .13;
            part.stops[1].setAttribute('offset', String(band - .13));
            part.stops[2].setAttribute('offset', String(band));
            part.stops[3].setAttribute('offset', String(band + .13));
            [0, .04, .65, .03, 0].forEach((gain, stop) => part.stops[stop].setAttribute('stop-color', metal(normal, false, gain)));
            const right = project(center.clone().addScaledVector(source.right.clone().applyQuaternion(rotation), .1));
            const down = project(center.clone().addScaledVector(source.up.clone().applyQuaternion(rotation), -.1));
            part.label.setAttribute('transform', `matrix(${(right[0] - origin[0]) * 10} ${(right[1] - origin[1]) * 10} ${(down[0] - origin[0]) * 10} ${(down[1] - origin[1]) * 10} ${origin[0]} ${origin[1]})`);
            part.label.setAttribute('font-size', revealed && source.value === value ? '.44' : '.31');
            part.label.setAttribute('opacity', String(.35 + normal.z * .65));
        });
    }
    draw(1, true);
    return { element, draw };
}
