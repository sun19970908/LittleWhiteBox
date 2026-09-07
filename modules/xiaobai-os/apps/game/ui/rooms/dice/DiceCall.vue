<script setup lang="ts">
import type { GameDiceBidView } from '../../../types.js';
import { diceCall } from './bid-presentation.js';
import Die from './Die.vue';
defineProps<{ bid: GameDiceBidView; speaker: string }>();
</script>
<template>
    <div class="dice-call" role="group" :aria-label="speaker + '叫' + diceCall(bid)">
        <h3>{{ speaker }}叫：{{ diceCall(bid) }}</h3>
        <div class="dice-call-dice" aria-hidden="true">
            <Die v-for="n in bid.count" :key="n" :value="bid.face" :animate="false" />
        </div>
        <p>叫的是两个人合起来的数量</p>
    </div>
</template>
