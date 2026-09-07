<script setup lang="ts">
import type { GameRecordDetailView } from '../../../types.js';
defineProps<{ detail: GameRecordDetailView }>();
</script>
<template>
    <p v-if="detail.kind === 'push'">这局找到了 {{ detail.revealedCoins }} 张金币。</p>
</template>
