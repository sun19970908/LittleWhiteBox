<script setup lang="ts">
import type { BankDepositProductView } from '../types.js';
defineProps<{ products: BankDepositProductView[]; balance: number; writeDisabledReason: string }>();
defineEmits<{ open: [product: BankDepositProductView] }>();
</script>
<template>
    <section class="bank-page" aria-labelledby="bank-deposits-title">
        <header class="bank-page-heading"><h2 id="bank-deposits-title">定期存单</h2></header>
        <div class="bank-product-grid">
            <article v-for="product in products" :key="product.id" class="bank-product-card bank-deposit-card">
                <header><h3>{{ product.name }}</h3><span class="bank-term-pill">{{ product.lockRounds }} 回合</span></header>
                <div class="bank-product-offer"><div class="bank-deposit-rate"><strong>{{ product.interestLabel }}</strong><span>整期收益率 · 非年化</span></div><button type="button" class="bank-primary-button" :aria-label="`存入${product.name}`" :disabled="Boolean(writeDisabledReason) || balance < product.minAmount" @click="$emit('open', product)">存入</button></div>
                <dl class="bank-product-terms"><div><dt>存入范围</dt><dd>{{ product.amountLabel }}</dd></div><div><dt>提前支取</dt><dd>本金 {{ product.earlyPenaltyLabel }}，无利息</dd></div></dl>
                <p v-if="balance < product.minAmount" class="bank-product-hint">钱包余额不足最低存入金额</p>
            </article>
        </div>
        <p class="bank-footnote">每完成一条剧情回复，推进一回合。</p>
    </section>
</template>
