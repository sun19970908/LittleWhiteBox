<script setup lang="ts">
import { computed } from 'vue';
import type { ShopActivationView } from '../types.js';
import ShopIcon from './ShopIcon.vue';
import ShopItemArt from './ShopItemArt.vue';
const props = defineProps<{ activations: ShopActivationView[]; writeDisabledReason: string }>();
defineEmits<{ deactivate: [activation: ShopActivationView]; inventory: [] }>();
const active = computed(() => props.activations.filter(activation => activation.state === 'active'));
const ended = computed(() => props.activations.filter(activation => activation.state !== 'active').slice().reverse());
</script>
<template>
    <section class="shop-page" aria-labelledby="shop-effects-title">
        <header class="shop-page-heading"><h2 id="shop-effects-title">生效中</h2><small>{{ active.length }} 个</small></header>
        <p v-if="writeDisabledReason" class="shop-hint" role="status">{{ writeDisabledReason }}</p>
        <div v-if="active.length" class="shop-effect-list">
            <article v-for="activation in active" :key="activation.activationId" class="shop-effect-card">
                <header><ShopItemArt :name="activation.icon" /><div><h3>{{ activation.name }}</h3><strong>{{ activation.stateLabel }}</strong></div></header>
                <dl v-if="activation.parameters.length" class="shop-effect-parameters"><div v-for="parameter in activation.parameters" :key="parameter.label"><dt>{{ parameter.label }}</dt><dd>{{ parameter.value }}</dd></div></dl>
                <footer><span>{{ activation.durationLabel }}</span><button v-if="activation.canDeactivate" type="button" class="shop-text-button" :disabled="Boolean(writeDisabledReason)" :aria-label="`关闭${activation.name}效果`" @click="$emit('deactivate', activation)">关闭效果</button><ShopIcon v-else name="lock" /></footer>
            </article>
        </div>
        <div v-else class="shop-empty"><ShopIcon name="spark" /><h3>暂无生效中的奇物</h3><button type="button" class="shop-secondary-button" @click="$emit('inventory')">打开背包</button></div>
        <details v-if="ended.length" class="shop-effect-history">
            <summary>已结束的效果 <small>{{ ended.length }} 个</small><ShopIcon name="next" /></summary>
            <article v-for="activation in ended" :key="activation.activationId"><header><h3>{{ activation.name }}</h3><span>{{ activation.stateLabel }}</span></header><p v-for="parameter in activation.parameters" :key="parameter.label"><span>{{ parameter.label }}</span>{{ parameter.value }}</p><small>{{ activation.durationLabel }}</small></article>
        </details>
    </section>
</template>
