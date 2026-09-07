<script setup lang="ts">
import type { GameRecordDetailView } from '../../../types.js';
defineProps<{ detail: GameRecordDetailView }>();
const names = { safe: '稳着走', medium: '跨一步', risky: '大胆跃' };
</script>
<template>
    <ol v-if="detail.kind === 'ladder'" class="game-record-steps">
        <li v-for="step in detail.steps" :key="step.floor">
            第 {{ step.floor }} 层 · {{ names[step.choice] }} ·
            {{ step.success ? '走过了，攒下 ¤ ' + step.amountAfterStep : '没站稳' }}
        </li>
    </ol>
</template>
