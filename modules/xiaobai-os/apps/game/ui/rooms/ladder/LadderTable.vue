<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { GameLadderGameView, GameLadderChoice } from '../../../types.js';
import type { GameSettlement } from '../../room-contract.js';
import GameResult from '../../GameResult.vue';
const props = defineProps<{
    game: GameLadderGameView;
    disabledReason: string;
    stepping: boolean;
    settlement: GameSettlement | null;
}>();
defineEmits<{ step: [choice: GameLadderChoice]; cashOut: []; again: []; lobby: []; revealed: [] }>();
const shown = ref({ ...props.game });
const judging = ref(false);
const fell = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
const choices = {
    safe: { name: '稳着走', mark: '—' },
    medium: { name: '跨一步', mark: '↗' },
    risky: { name: '大胆跃', mark: '↟' },
};
function judge(land: () => void): void {
    clearTimeout(timer);
    judging.value = true;
    const delay =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720;
    timer = setTimeout(() => {
        land();
        judging.value = false;
    }, delay);
}
watch(
    () => props.game.completedFloors,
    (next, previous) => {
        if (next > previous) {
            judge(() => {
                shown.value = { ...props.game };
            });
        }
    },
);
watch(
    () => props.settlement,
    (value) => {
        if (!value || value.record.detail.kind !== 'ladder' || value.record.outcome === 'cashed-out') {
            return;
        }
        const last = value.record.detail.steps.at(-1);
        if (last) {
            judge(() => {
                fell.value = !last.success;
                if (last.success) {
                    shown.value = {
                        ...props.game,
                        completedFloors: last.floor,
                        cashoutAmount: last.amountAfterStep,
                        canCashOut: true,
                    };
                }
            });
        }
    },
    { immediate: true },
);
const disabled = computed(
    () => Boolean(props.disabledReason) || props.stepping || judging.value || Boolean(props.settlement),
);
onBeforeUnmount(() => clearTimeout(timer));
</script>
<template>
    <section class="ladder-table">
        <header class="room-heading">
            <small>本局筹码 ¤ {{ game.bet }}</small>
        </header>
        <div class="ladder-landscape" :class="{ 'is-climbing': stepping || judging, 'is-fallen': fell }">
            <div class="ladder-prize">
                <span>{{ settlement && !judging ? '这一局，拿回' : shown.canCashOut ? '现在收手，带走' : '走过第一层就能收手' }}</span>
                <strong>{{ settlement && !judging ? '¤ ' + settlement.record.payout : shown.canCashOut ? '¤ ' + shown.cashoutAmount : '从这里出发' }}</strong>
            </div>
            <div class="ladder-stairs" aria-label="五层阶梯">
                <div
                    v-for="floor in 5"
                    :key="floor"
                    class="ladder-stair"
                    :style="{ '--floor': floor }"
                    :class="{
                        'is-done': floor <= shown.completedFloors,
                        'is-next': floor === shown.completedFloors + 1,
                    }"
                >
                    <span>{{ floor }}</span><i v-if="floor === 5" aria-hidden="true">✦</i>
                </div>
                <span
                    class="ladder-traveler"
                    :style="{ '--position': shown.completedFloors }"
                    aria-hidden="true"
                ><i /></span>
            </div>
            <p role="status">
                {{
                    stepping || judging
                        ? '迈出这一步，看看能不能站稳…'
                        : fell
                            ? '这一步没站稳，下局再来。'
                            : shown.completedFloors === 5
                                ? '五层登顶！'
                                : '已走过 ' + shown.completedFloors + ' 层 / 共 5 层'
                }}
            </p>
        </div>
        <GameResult
            v-if="settlement && !judging"
            :record="settlement.record"
            :balance-after="settlement.balanceAfter"
            :disabled="Boolean(disabledReason)"
            @revealed="$emit('revealed')"
            @again="$emit('again')"
            @lobby="$emit('lobby')"
        />
        <template v-else-if="!settlement">
            <div class="ladder-next">
                <h3>第 {{ shown.completedFloors + 1 }} 层，怎么走？</h3>
                <p>成功继续向上，失败本局归零。</p>
            </div>
            <div class="ladder-paths">
                <button
                    v-for="option in shown.nextChoices"
                    :key="option.choice"
                    type="button"
                    :class="'is-' + option.choice"
                    :disabled="disabled"
                    @click="$emit('step', option.choice)"
                >
                    <i aria-hidden="true">{{ choices[option.choice].mark }}</i><strong>{{ choices[option.choice].name }}</strong><span>{{ option.successProbabilityBps / 100 }}% 能走过</span><small>走过后拿回</small><b>¤ {{ option.successAmount }}</b>
                </button>
            </div>
            <button
                type="button"
                class="game-secondary-action ladder-cashout"
                :disabled="disabled || !shown.canCashOut"
                @click="$emit('cashOut')"
            >
                {{ shown.canCashOut ? '就到这里，带走 ¤ ' + shown.cashoutAmount : '走过第一层后，可以收手' }}
            </button>
        </template>
    </section>
</template>
