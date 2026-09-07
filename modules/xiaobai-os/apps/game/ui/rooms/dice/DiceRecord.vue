<script setup lang="ts">
import type { GameRecordDetailView } from '../../../types.js';
import Die from './Die.vue';
import { diceCall, diceMatch } from './bid-presentation.js';
defineProps<{ detail: GameRecordDetailView }>();
</script>
<template>
    <div v-if="detail.kind === 'dice'" class="dice-record">
        <p>
            {{ detail.finalBid.by === 'player' ? '你' : '对方' }}叫{{ diceCall(detail.finalBid) }} ·
            {{ detail.challenger === 'player' ? '你' : '对方' }}开盅
        </p>
        <p>
            实际有{{ diceCall({ count: detail.matchingDiceCount, face: detail.finalBid.face }) }}（一点百搭）
        </p>
        <span>对方的骰子</span>
        <div class="game-dice-row">
            <Die
                v-for="(die, i) in detail.dealerDice"
                :key="i"
                :value="die"
                :animate="false"
                :highlight="diceMatch(die, detail.finalBid.face)"
            />
        </div>
        <span>你的骰子</span>
        <div class="game-dice-row">
            <Die
                v-for="(die, i) in detail.playerDice"
                :key="i"
                :value="die"
                :animate="false"
                :highlight="diceMatch(die, detail.finalBid.face)"
            />
        </div>
    </div>
</template>
