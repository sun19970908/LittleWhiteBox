<script setup lang="ts">
import WalletIcon from './WalletIcon.vue';
defineProps<{ refreshing: boolean; disabled: boolean }>();
defineEmits<{ refresh: [] }>();
</script>
<template>
    <header class="wallet-ui-header">
        <span class="wallet-brand"><WalletIcon name="wallet" /></span>
        <h1 class="wallet-ui-title">钱包</h1>
        <span class="wallet-header-context">当前聊天</span>
        <button type="button" class="wallet-icon-button" :disabled="disabled" aria-label="刷新钱包" @click="$emit('refresh')"><WalletIcon name="refresh" :class="{ 'is-spinning': refreshing }" /></button>
    </header>
</template>
