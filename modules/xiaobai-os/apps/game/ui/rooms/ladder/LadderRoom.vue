<script setup lang="ts">
import { computed } from 'vue';
import type { GameRoomProps, GameAction } from '../../room-contract.js';
import { gameInfo } from '../../../catalog.js';
import GameEntry from '../../GameEntry.vue';
import LadderTable from './LadderTable.vue';
const props = defineProps<GameRoomProps>();
defineEmits<{ action: [action: GameAction]; again: []; lobby: []; revealed: []; resume: [] }>();
const game = computed(() =>
    props.settlement?.before.kind === 'ladder'
        ? props.settlement.before
        : props.state.activeGame?.kind === 'ladder'
          ? props.state.activeGame
          : null,
);
</script>
<template>
    <LadderTable
        v-if="game"
        :key="game.id"
        :game="game"
        :disabled-reason="disabledReason"
        :settlement="settlement"
        :stepping="inFlight?.endpoint === 'game/ladder/step'"
        @step="
            (choice) =>
                $emit('action', { endpoint: 'game/ladder/step', payload: { gameId: game!.id, choice } })
        "
        @cash-out="$emit('action', { endpoint: 'game/ladder/cash-out', payload: { gameId: game!.id } })"
        @revealed="$emit('revealed')"
        @again="$emit('again')"
        @lobby="$emit('lobby')"
    />
    <GameEntry
        v-else
        kind="ladder"
        :minimum="30"
        :maximum="300"
        :step="10"
        :initial="30"
        :chips="[30, 50, 100, 300]"
        :balance="state.balance"
        :disabled-reason="disabledReason"
        :other-game="state.activeGame ? gameInfo(state.activeGame.kind).name : ''"
        :rules="[
            '共五层，每一步都能选一条路。胜算越低，成功后的奖励越高。',
            '走过第一层，就能收手带走奖励；继续走，失败则本局归零。',
            '登顶自动结算，单局最多拿回 50,000 小白币。稳妥的路也有失败的可能。',
        ]"
        @start="(bet) => $emit('action', { endpoint: 'game/ladder/start', payload: { bet } })"
        @resume="$emit('resume')"
    />
</template>
