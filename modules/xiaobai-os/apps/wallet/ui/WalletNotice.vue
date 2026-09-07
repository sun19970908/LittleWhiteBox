<script lang="ts">
export type WalletNoticeTone = 'info' | 'warning' | 'danger';
</script>

<script setup lang="ts">
withDefaults(defineProps<{
    title: string;
    message?: string;
    tone?: WalletNoticeTone;
}>(), { message: '', tone: 'info' });
</script>

<template>
    <aside class="wallet-ui-notice" :class="`is-${tone}`" role="status">
        <span class="wallet-ui-notice-icon" aria-hidden="true">
            <slot name="icon">!</slot>
        </span>
        <div class="wallet-ui-notice-copy">
            <strong>{{ title }}</strong>
            <p v-if="message">{{ message }}</p>
            <slot />
        </div>
    </aside>
</template>
