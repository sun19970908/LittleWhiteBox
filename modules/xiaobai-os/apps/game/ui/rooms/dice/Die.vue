<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { GameDieFace } from '../../../types.js';
import { GAME_DIE_PIPS } from '../../die-pips.js';
import { GAME_DIE_ROLL_MS } from '../../game-motion.js';

const props = withDefaults(
    defineProps<{
        value: GameDieFace;
        delay?: number;
        highlight?: boolean;
        animate?: boolean;
    }>(),
    { delay: 0, highlight: false, animate: true },
);

/** Which pip face is glued to each side of the cube. Opposite sides sum to 7. */
const FACES: ReadonlyArray<{ side: string; face: GameDieFace }> = [
    { side: 'is-front', face: 1 },
    { side: 'is-back', face: 6 },
    { side: 'is-top', face: 5 },
    { side: 'is-bottom', face: 2 },
    { side: 'is-left', face: 4 },
    { side: 'is-right', face: 3 },
];

/** Rotation that brings a given face to the front, in [rotateX, rotateY] degrees. */
const FACE_UP: Readonly<Record<GameDieFace, readonly [number, number]>> = {
    1: [0, 0],
    2: [90, 180],
    3: [0, -90],
    4: [0, 90],
    5: [-90, 0],
    6: [180, 0],
};

function cubeTransform(x: number, y: number): string {
    // The roll is fully three-dimensional, but the result face settles square
    // to the player. Showing three readable faces at rest makes the actual
    // value ambiguous on a phone-sized table.
    return `rotateX(${x}deg) rotateY(${y}deg)`;
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

const cube = ref<HTMLElement | null>(null);
const shell = ref<HTMLElement | null>(null);
let rollAnimation: Animation | null = null;
let hopAnimation: Animation | null = null;

function settle(): void {
    const [x, y] = FACE_UP[props.value];
    if (cube.value) {
        cube.value.style.transform = cubeTransform(x, y);
    }
}

function roll(): void {
    const cubeElement = cube.value;
    if (!cubeElement) {
        return;
    }

    rollAnimation?.cancel();
    hopAnimation?.cancel();
    rollAnimation = null;
    hopAnimation = null;

    if (!props.animate || prefersReducedMotion() || typeof cubeElement.animate !== 'function') {
        settle();
        return;
    }

    const [x, y] = FACE_UP[props.value];
    // Whole turns plus a fixed offset. Whole turns alone would make the start
    // pose identical to the end pose, so the die would sit showing its result
    // and then spin back to it; the offset keeps the opening frame tilted.
    // Randomising the start angle instead (as the demo did) lets a die land
    // almost without turning.
    const spinX = 360 * (2 + Math.floor(Math.random() * 2)) + 146;
    const spinY = 360 * (1 + Math.floor(Math.random() * 2)) + 101;

    rollAnimation = cubeElement.animate(
        [
            { transform: cubeTransform(x - spinX, y - spinY), easing: 'cubic-bezier(.11,.58,.32,1)' },
            { transform: cubeTransform(x + 13, y + 9), offset: 0.84, easing: 'cubic-bezier(.36,0,.4,1)' },
            { transform: cubeTransform(x, y) },
        ],
        { duration: GAME_DIE_ROLL_MS, delay: props.delay, fill: 'both' },
    );

    hopAnimation =
        shell.value?.animate(
            [
                { transform: 'translateY(-16px) scale(1.06)', easing: 'cubic-bezier(.4,0,.7,1)' },
                { transform: 'translateY(0) scale(1)', offset: 0.5, easing: 'cubic-bezier(.2,0,.2,1)' },
                {
                    transform: 'translateY(-6px) scale(1.02)',
                    offset: 0.68,
                    easing: 'cubic-bezier(.4,0,.7,1)',
                },
                { transform: 'translateY(0) scale(1)', offset: 0.82, easing: 'cubic-bezier(.2,0,.4,1)' },
                { transform: 'translateY(-1.5px) scale(1)', offset: 0.9 },
                { transform: 'translateY(0) scale(1)' },
            ],
            { duration: GAME_DIE_ROLL_MS, delay: props.delay, fill: 'both' },
        ) ?? null;
}

onMounted(roll);
onUnmounted(() => {
    rollAnimation?.cancel();
    hopAnimation?.cancel();
});
watch(() => props.value, roll);
</script>

<template>
    <div
        ref="shell"
        class="game-die"
        :class="{ 'is-hit': highlight }"
        role="img"
        :aria-label="`骰子 ${value} 点`"
    >
        <div class="game-die-stage">
            <div ref="cube" class="game-die-cube">
                <div
                    v-for="side in FACES"
                    :key="side.side"
                    class="game-die-face"
                    :class="[side.side, { 'is-result': side.face === value }]"
                >
                    <div class="game-die-pips">
                        <i
                            v-for="([row, column], index) in GAME_DIE_PIPS[side.face]"
                            :key="index"
                            class="game-die-pip"
                            :style="{ gridArea: `${row} / ${column}` }"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
