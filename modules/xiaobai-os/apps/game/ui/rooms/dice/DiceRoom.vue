<script setup lang="ts">
import { computed } from 'vue';
import type { GameRoomProps, GameAction } from '../../room-contract.js';
import { gameInfo } from '../../../catalog.js';
import GameEntry from '../../GameEntry.vue';
import DiceTable from './DiceTable.vue';
import DiceShowdown from './DiceShowdown.vue';
const props = defineProps<GameRoomProps>();
defineEmits<{ action: [action: GameAction]; again: []; lobby: []; revealed: []; resume: [] }>();
const game = computed(() => (props.state.activeGame?.kind === 'dice' ? props.state.activeGame : null));
const result = computed(() => (props.settlement?.record.detail.kind === 'dice' ? props.settlement : null));
const opening = computed(() => props.inFlight?.endpoint === 'game/dice/challenge');
</script>
<template>
    <DiceShowdown
        v-if="result && result.record.detail.kind === 'dice'"
        :record="result.record"
        :detail="result.record.detail"
        :balance-after="result.balanceAfter"
        :disabled="Boolean(disabledReason)"
        @revealed="$emit('revealed')"
        @again="$emit('again')"
        @lobby="$emit('lobby')"
    />
    <section v-else-if="opening" class="dice-opening" role="status">
        <span class="dice-cup is-shaking" aria-hidden="true" />
        <h2>开盅见分晓</h2>
        <p>结果确认后，双方一起亮骰。</p>
    </section>
    <DiceTable
        v-else-if="game"
        :game="game"
        :disabled-reason="disabledReason"
        :busy="Boolean(inFlight)"
        @bid="(bid) => $emit('action', { endpoint: 'game/dice/bid', payload: { gameId: game!.id, bid } })"
        @challenge="$emit('action', { endpoint: 'game/dice/challenge', payload: { gameId: game!.id } })"
    />
    <GameEntry
        v-else
        kind="dice"
        :minimum="50"
        :maximum="500"
        :step="10"
        :initial="50"
        :chips="[50, 100, 200, 500]"
        :balance="state.balance"
        :disabled-reason="disabledReason"
        :other-game="state.activeGame ? gameInfo(state.activeGame.kind).name : ''"
        :rules="[
            '每人五颗骰子，只能看自己的。轮流叫「几个几」，叫的是两个人合起来至少有这么多。',
            '一点百搭；叫数只能越来越大。不信对方，就开盅：不够数，叫的人输；够数，开的人输。',
            '赢了拿回下注的 1.8 倍（含本金）；输了，本局筹码归对方。',
        ]"
        @start="(bet) => $emit('action', { endpoint: 'game/dice/start', payload: { bet } })"
        @resume="$emit('resume')"
    />
</template>
