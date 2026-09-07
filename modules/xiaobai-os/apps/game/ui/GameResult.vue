<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { GameRecordView } from '../types.js';
const props = defineProps<{ record: GameRecordView; balanceAfter: number; disabled: boolean }>();
const emit = defineEmits<{ again: []; lobby: []; revealed: [] }>();
onMounted(() => emit('revealed'));
const net = computed(() => (props.record.net > 0 ? '+' : '') + props.record.net.toLocaleString('zh-CN'));
</script>
<template>
    <section class="game-result" :class="'is-' + record.outcomeTone" aria-label="本局结算">
        <h3>{{ record.outcomeLabel }}</h3>
        <strong class="game-result-net">{{ net }}<small>小白币</small></strong>
        <p>下注 {{ record.amountIn }} · 拿回 {{ record.payout }}（含返还的本金）</p>
        <p>现在有 {{ balanceAfter.toLocaleString('zh-CN') }} 小白币</p>
        <div>
            <button type="button" class="game-primary-action" :disabled="disabled" @click="$emit('again')">
                再玩一局
            </button><button type="button" class="game-secondary-action" @click="$emit('lobby')">回大厅</button>
        </div>
    </section>
</template>
