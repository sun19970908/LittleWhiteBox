<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { GameDiceRecordDetailView, GameRecordView } from '../../../types.js';
import Die from './Die.vue';
import DiceCall from './DiceCall.vue';
import GameResult from '../../GameResult.vue';
import { diceCall, diceMatch } from './bid-presentation.js';
import { gameDiceRevealTimeline } from '../../game-motion.js';
const props = defineProps<{
    record: GameRecordView;
    detail: GameDiceRecordDetailView;
    balanceAfter: number;
    disabled: boolean;
}>();
defineEmits<{ again: []; lobby: []; revealed: [] }>();
const counted = ref(false);
const revealed = ref(false);
const timers: ReturnType<typeof setTimeout>[] = [];
const enough = computed(() => props.detail.matchingDiceCount >= props.detail.finalBid.count);
const wildcard = computed(
    () => [...props.detail.dealerDice, ...props.detail.playerDice].filter((die) => die === 1).length,
);
function finish(): void {
    counted.value = true;
    revealed.value = true;
    timers.forEach(clearTimeout);
}
onMounted(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
    }
    const timeline = gameDiceRevealTimeline(5);
    timers.push(
        setTimeout(() => {
            counted.value = true;
        }, timeline.countAt),
        setTimeout(() => {
            revealed.value = true;
        }, timeline.verdictAt),
    );
});
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>
<template>
    <section class="dice-showdown" aria-label="开盅结果">
        <DiceCall :bid="detail.finalBid" :speaker="detail.finalBid.by === 'player' ? '你' : '对方'" />
        <div class="dice-reveal-hand">
            <span>对方的骰子</span>
            <div class="game-dice-row">
                <Die
                    v-for="(die, index) in detail.dealerDice"
                    :key="index"
                    :value="die"
                    :delay="index * 45"
                    :highlight="counted && diceMatch(die, detail.finalBid.face)"
                />
            </div>
        </div>
        <div class="dice-reveal-hand">
            <span>你的骰子</span>
            <div class="game-dice-row">
                <Die
                    v-for="(die, index) in detail.playerDice"
                    :key="index"
                    :value="die"
                    :delay="index * 45"
                    :highlight="counted && diceMatch(die, detail.finalBid.face)"
                />
            </div>
        </div>
        <p v-if="counted" class="dice-verdict">
            合起来{{ enough ? '有' : '只有'
            }}<strong>{{ diceCall({ count: detail.matchingDiceCount, face: detail.finalBid.face }) }}</strong>，{{ enough ? '够数' : '不够' }}。<small>包含 {{ wildcard }} 颗百搭的一点 ·
                {{ detail.challenger === 'player' ? '你开的盅' : '对方开的盅' }}</small>
        </p>
        <GameResult
            v-if="revealed"
            :record="record"
            :balance-after="balanceAfter"
            :disabled="disabled"
            @revealed="$emit('revealed')"
            @again="$emit('again')"
            @lobby="$emit('lobby')"
        />
        <button v-else type="button" class="game-skip-reveal" @click="finish">直接看结果</button>
    </section>
</template>
