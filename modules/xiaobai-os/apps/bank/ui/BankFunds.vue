<script setup lang="ts">
import type { BankFundProductView } from '../types.js';
defineProps<{ products: BankFundProductView[]; balance: number; writeDisabledReason: string }>();
defineEmits<{ open: [product: BankFundProductView] }>();
</script>
<template>
    <section class="bank-page" aria-labelledby="bank-funds-title">
        <header class="bank-page-heading"><h2 id="bank-funds-title">浮动理财</h2><p>可能损失本金，到期前不可退出。</p></header>
        <div class="bank-product-grid">
            <article v-for="product in products" :key="product.id" class="bank-product-card bank-fund-card" :data-risk="product.riskLevel">
                <header><h3>{{ product.name }}</h3><span class="bank-risk-badge" :class="`is-${product.riskLevel}`">{{ product.riskLabel }}</span></header>
                <p class="bank-fund-description">{{ product.description }}</p>
                <div class="bank-product-offer"><div class="bank-return-range"><strong>{{ product.returnLabel }}</strong><span>整期收益区间 · 非年化</span></div><button type="button" class="bank-primary-button" :aria-label="`申购${product.name}`" :disabled="Boolean(writeDisabledReason) || balance < product.minAmount" @click="$emit('open', product)">申购</button></div>
                <dl class="bank-product-terms"><div><dt>申购范围</dt><dd>{{ product.amountLabel }}</dd></div><div><dt>锁定期限</dt><dd>{{ product.lockRounds }} 回合</dd></div></dl>
                <p v-if="balance < product.minAmount" class="bank-product-hint">钱包余额不足最低申购金额</p>
            </article>
        </div>
        <p class="bank-footnote">以上为合同区间，实际收益到期揭晓。</p>
    </section>
</template>
