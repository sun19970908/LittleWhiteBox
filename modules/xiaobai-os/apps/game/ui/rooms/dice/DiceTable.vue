<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GameDiceGameView, GameDiceBidFace, GameDiceBidView } from '../../../types.js';
import Die from './Die.vue';
import DiceCall from './DiceCall.vue';
import { availableFaces, diceCall } from './bid-presentation.js';
const props = defineProps<{ game: GameDiceGameView; disabledReason: string; busy: boolean }>();
const emit = defineEmits<{ bid: [bid: GameDiceBidView]; challenge: [] }>();
const count = ref(props.game.legalBids[0]?.count || 1);
const face = ref<GameDiceBidFace>(props.game.legalBids[0]?.face || 2);
const current = computed(() => props.game.bids.at(-1));
const counts = computed(() => [...new Set(props.game.legalBids.map((bid) => bid.count))]);
const faces = computed(() => availableFaces(props.game.legalBids, count.value));
watch(
    () => props.game.legalBids,
    () => {
        if (!counts.value.includes(count.value)) {
            count.value = counts.value[0] || 1;
        }
        if (!faces.value.includes(face.value)) {
            face.value = faces.value[0] || 2;
        }
    },
    { immediate: true },
);
function changeCount(delta: number): void {
    const next = counts.value[counts.value.indexOf(count.value) + delta];
    if (next === undefined) {
        return;
    }
    count.value = next;
    if (!faces.value.includes(face.value)) {
        face.value = faces.value[0];
    }
}
function bid(): void {
    if (!props.disabledReason && faces.value.includes(face.value)) {
        emit('bid', { count: count.value, face: face.value });
    }
}
</script>
<template>
    <section class="dice-table" aria-label="大话骰牌桌">
        <p class="dice-stake">本局筹码 ¤ {{ game.bet }}</p>
        <div class="dice-opponent">
            <span class="dice-cup" aria-hidden="true" />
            <div>
                <strong>对面那位</strong><small>{{
                    busy
                        ? '正琢磨怎么接你的话…'
                        : current
                            ? '轮到你了，跟着叫，还是开？'
                            : '骰子摇好了，你先叫。'
                }}</small>
            </div>
            <span class="dice-hidden-count">5 颗暗骰</span>
        </div>
        <DiceCall v-if="current" :bid="current" :speaker="current.by === 'dealer' ? '对方' : '你'" />
        <div v-else class="dice-first-call">
            <span>你先来</span>
            <p>猜猜两个人的骰子里<br>至少有几个相同的点数？</p>
        </div>
        <div class="dice-own-hand">
            <small>你的骰子</small>
            <div class="game-dice-row">
                <Die v-for="(die, index) in game.playerDice" :key="index" :value="die" :delay="index * 45" />
            </div>
            <p><span class="dice-wild-dot" />一点百搭，开盅时也算你叫的点数</p>
        </div>
        <div v-if="game.legalActions.includes('bid')" class="dice-builder">
            <div class="dice-builder-label">
                <strong>这一口，你叫</strong><span>至少 {{ count }} 颗</span>
            </div>
            <div class="dice-number-picker">
                <button
                    type="button"
                    aria-label="少叫一个"
                    :disabled="Boolean(disabledReason) || count === counts[0]"
                    @click="changeCount(-1)"
                >
                    −
                </button><strong>{{ count }}<small>个</small></strong><button
                    type="button"
                    aria-label="多叫一个"
                    :disabled="Boolean(disabledReason) || count === counts.at(-1)"
                    @click="changeCount(1)"
                >
                    +
                </button>
            </div>
            <div class="dice-face-picker" role="group" aria-label="叫哪个点数">
                <button
                    v-for="option in [2, 3, 4, 5, 6] as const"
                    :key="option"
                    type="button"
                    :aria-label="option + '点'"
                    :aria-pressed="face === option"
                    :disabled="Boolean(disabledReason) || !faces.includes(option)"
                    @click="face = option"
                >
                    <Die :value="option" :animate="false" />
                </button>
            </div>
            <div class="dice-turn-actions">
                <button
                    type="button"
                    class="game-primary-action"
                    :disabled="Boolean(disabledReason) || !faces.includes(face)"
                    @click="bid"
                >
                    叫{{ diceCall({ count, face }) }}
                </button><button
                    v-if="game.legalActions.includes('challenge')"
                    type="button"
                    class="dice-open-cup"
                    :disabled="Boolean(disabledReason)"
                    @click="$emit('challenge')"
                >
                    开盅<small>不信他有这么多</small>
                </button>
            </div>
        </div>
        <div v-else class="dice-last-call">
            <p>已经叫到头了，开盅见分晓。</p>
            <button
                type="button"
                class="game-primary-action"
                :disabled="Boolean(disabledReason)"
                @click="$emit('challenge')"
            >
                开盅
            </button>
        </div>
        <details class="game-small-rules">
            <summary>规则与叫骰记录</summary>
            <p>数量更多，或数量相同而点数更大，都算加叫。一点只作百搭，不能单独叫。</p>
            <ol class="dice-call-history">
                <li v-for="(call, index) in game.bids" :key="index">
                    <span>{{ call.by === 'player' ? '你' : '对方' }}</span><strong>{{ diceCall(call) }}</strong>
                </li>
            </ol>
        </details>
    </section>
</template>
