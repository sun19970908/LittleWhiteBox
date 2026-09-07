<script setup lang="ts">
import type { WalletTransactionView } from '../types.js';
import WalletIcon from './WalletIcon.vue';
import { walletAmount, walletDirection, walletTransactionIcon } from './wallet-display.js';
defineProps<{ transaction: WalletTransactionView }>();
defineEmits<{ open: [transaction: WalletTransactionView] }>();
const timeFormatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
</script>
<template>
    <li>
        <button type="button" class="wallet-row" :class="`is-${transaction.direction}`" @click="$emit('open', transaction)">
            <span class="wallet-row-mark" aria-hidden="true"><WalletIcon :name="walletTransactionIcon(transaction)" /></span>
            <span class="wallet-row-copy"><strong>{{ transaction.title }}</strong><small>{{ transaction.source }} · {{ timeFormatter.format(transaction.createdAt) }}</small></span>
            <span class="wallet-row-value"><strong>{{ walletAmount(transaction) }}</strong><small>{{ walletDirection[transaction.direction] }}</small></span>
        </button>
    </li>
</template>
