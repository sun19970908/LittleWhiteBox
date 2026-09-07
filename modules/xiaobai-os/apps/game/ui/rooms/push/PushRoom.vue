<script setup lang="ts">
import { computed } from 'vue';
import type { GameRoomProps, GameAction } from '../../room-contract.js';
import { gameInfo } from '../../../catalog.js';
import GameEntry from '../../GameEntry.vue';
import PushTable from './PushTable.vue';
const props = defineProps<GameRoomProps>();
defineEmits<{ action: [action: GameAction]; again: []; lobby: []; revealed: []; resume: [] }>();
const game = computed(() =>
    props.settlement?.before.kind === 'push'
        ? props.settlement.before
        : props.state.activeGame?.kind === 'push'
          ? props.state.activeGame
          : null,
);
</script>
<template>
    <PushTable
        v-if="game"
        :key="game.id"
        :game="game"
        :disabled-reason="disabledReason"
        :settlement="settlement"
        :drawing="inFlight?.endpoint === 'game/push/draw'"
        @draw="$emit('action', { endpoint: 'game/push/draw', payload: { gameId: game.id } })"
        @cash-out="$emit('action', { endpoint: 'game/push/cash-out', payload: { gameId: game.id } })"
        @revealed="$emit('revealed')"
        @again="$emit('again')"
        @lobby="$emit('lobby')"
    />
    <GameEntry
        v-else
        kind="push"
        :minimum="50"
        :maximum="50"
        :step="1"
        :initial="50"
        :chips="[50]"
        :balance="state.balance"
        :disabled-reason="disabledReason"
        :other-game="state.activeGame ? gameInfo(state.activeGame.kind).name : ''"
        :rules="[
            '一副十张牌：七张金币，三张炸弹。每局下注 50 小白币。',
            '每翻出一张金币，攒下 50 小白币。随时收手，把攒下的钱带走。',
            '翻到炸弹，本局一分也拿不走。七张金币全找到，自动结算。',
        ]"
        @start="$emit('action', { endpoint: 'game/push/start' })"
        @resume="$emit('resume')"
    />
</template>
