<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppBack } from '../../../shell/app-src/navigation/app-navigation.js';
import type { AdministratorContextUsage } from '../domain/types.js';
import { ADMINISTRATOR_COPY as C } from './copy.js';
const props = defineProps<{ usage: AdministratorContextUsage; draftTokens: number }>();
const open = ref(false);
const total = computed(() => props.usage.used + props.draftTokens);
const format = (value: number) => `${(value / 1000).toFixed(1)}k`;
useAppBack(() => { open.value = false; return true; }, () => open.value);
</script>

<template>
    <div class="admin-context" @keydown.esc.stop="open = false">
        <button
            type="button" class="admin-context-ring" :class="{ 'is-warning': total >= usage.trigger }"
            :style="{ '--context-fill': `${Math.min(1, total / usage.limit) * 360}deg` }"
            :aria-label="C.context" :title="C.context" :aria-expanded="open" @click="open = !open"
        >
            <span />
        </button>
        <section v-if="open" class="admin-popover">
            <header><strong>{{ C.context }}</strong><button type="button" :aria-label="C.close" @click="open = false">×</button></header>
            <p class="admin-context-total">{{ format(total) }} / {{ format(usage.limit) }}</p>
            <dl><template v-for="(label, key) in C.contextParts" :key="key"><dt>{{ label }}</dt><dd>{{ format(usage[key] + (key === 'history' ? draftTokens : 0)) }}</dd></template></dl>
            <small>{{ C.budgetNote }}</small>
        </section>
    </div>
</template>
