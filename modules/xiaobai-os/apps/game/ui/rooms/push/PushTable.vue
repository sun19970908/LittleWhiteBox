<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { GamePushGameView } from '../../../types.js';
import type { GameSettlement } from '../../room-contract.js';
import GameResult from '../../GameResult.vue';
const props = defineProps<{
    game: GamePushGameView;
    disabledReason: string;
    drawing: boolean;
    settlement: GameSettlement | null;
}>();
defineEmits<{ draw: []; cashOut: []; again: []; lobby: []; revealed: [] }>();
const shown = ref({ ...props.game });
const face = ref<'coin' | 'bomb' | null>(null);
const turning = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
function reveal(nextFace: 'coin' | 'bomb', land: () => void): void {
    clearTimeout(timer);
    face.value = nextFace;
    turning.value = true;
    const delay =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 660;
    timer = setTimeout(() => {
        land();
        turning.value = false;
    }, delay);
}
watch(
    () => props.drawing,
    (value) => {
        if (value) {
            face.value = null;
        }
    },
);
watch(
    () => props.game.revealedCoins,
    (next, previous) => {
        if (next > previous) {
            reveal('coin', () => {
                shown.value = { ...props.game };
            });
        }
    },
);
watch(
    () => props.settlement,
    (value) => {
        if (!value || value.record.detail.kind !== 'push') {
            return;
        }
        if (value.record.outcome === 'cashed-out') {
            return;
        }
        reveal(value.record.outcome === 'busted' ? 'bomb' : 'coin', () => {
            if (value.record.detail.kind !== 'push') {
                return;
            }
            shown.value = {
                ...props.game,
                revealedCoins: value.record.detail.revealedCoins,
                cashoutAmount: value.record.payout,
            };
        });
    },
    { immediate: true },
);
const disabled = computed(
    () => Boolean(props.disabledReason) || props.drawing || turning.value || Boolean(props.settlement),
);
const risk = computed(() =>
    (shown.value.nextBombProbabilityBps / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
);
onBeforeUnmount(() => clearTimeout(timer));
</script>
<template>
    <section class="push-table">
        <header class="room-heading">
            <small>本局筹码 ¤ {{ game.bet }}</small>
        </header>
        <div class="push-felt">
            <div class="push-pot">
                <span>{{ settlement && !turning ? '这一局，拿回' : '现在收手，带走' }}</span><strong>¤ {{ shown.cashoutAmount }}</strong>
            </div>
            <div class="push-card-stage">
                <div class="push-deck" aria-hidden="true"><i /><i /><i /></div>
                <div
                    class="push-card"
                    :class="{ 'is-turning': turning, 'is-revealed': face, 'is-waiting': drawing }"
                >
                    <div class="push-card-inner">
                        <span class="push-card-back" aria-hidden="true"><b>金</b></span>
                        <span
                            class="push-card-face"
                            :class="{ 'is-bomb': face === 'bomb' }"
                            aria-hidden="true"
                        ><b>{{ face === 'bomb' ? '✹' : '¤' }}</b><small>{{ face === 'bomb' ? '炸弹' : '+50' }}</small></span>
                    </div>
                </div>
            </div>
            <p class="push-table-talk" role="status">
                {{
                    drawing
                        ? '牌还没亮，稍等一下…'
                        : turning
                            ? '翻开看看…'
                            : face === 'bomb'
                                ? '哎呀，是炸弹。'
                                : face === 'coin'
                                    ? '是金币！还要再来一张吗？'
                                    : '牌已洗好，翻一张试试手气。'
                }}
            </p>
            <div class="push-coins" :aria-label="'已找到 ' + shown.revealedCoins + ' 张金币'">
                <span
                    v-for="n in 7"
                    :key="n"
                    :class="{ 'is-found': n <= shown.revealedCoins }"
                    aria-hidden="true"
                >¤</span>
            </div>
        </div>
        <GameResult
            v-if="settlement && !turning"
            :record="settlement.record"
            :balance-after="settlement.balanceAfter"
            :disabled="Boolean(disabledReason)"
            @revealed="$emit('revealed')"
            @again="$emit('again')"
            @lobby="$emit('lobby')"
        />
        <template v-else-if="!settlement">
            <div class="push-odds">
                <span>还剩 <b>{{ shown.remainingCards }}</b> 张牌，其中
                    <b>{{ shown.remainingBombs }}</b> 张炸弹</span><small>下一张翻到炸弹的概率 {{ risk }}%</small>
            </div>
            <div class="room-actions">
                <button type="button" class="game-primary-action" :disabled="disabled" @click="$emit('draw')">
                    {{ shown.revealedCoins ? '再翻一张' : '翻第一张' }}
                </button>
                <button
                    type="button"
                    class="game-secondary-action"
                    :disabled="disabled || !game.legalActions.includes('cash-out')"
                    @click="$emit('cashOut')"
                >
                    收手，拿走 ¤ {{ shown.cashoutAmount }}
                </button>
            </div>
            <p class="game-help">每张金币 +50；翻到炸弹，本局归零。</p>
        </template>
    </section>
</template>
