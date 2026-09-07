<script setup lang="ts">
import type { BankDepositPositionView, BankFundPositionView } from '../types.js';
import BankProductIcon from './BankProductIcon.vue';
defineProps<{ deposits: BankDepositPositionView[]; investments: BankFundPositionView[]; claimableCount: number; writeDisabledReason: string }>();
defineEmits<{ withdraw: [position: BankDepositPositionView]; settle: []; browse: [] }>();
</script>
<template>
    <section class="bank-page" aria-labelledby="bank-positions-title">
        <header class="bank-page-heading"><h2 id="bank-positions-title">我的持有</h2></header>
        <button v-if="claimableCount" type="button" class="bank-claim-button" :disabled="Boolean(writeDisabledReason)" @click="$emit('settle')"><BankProductIcon kind="check" /><span>{{ claimableCount }} 笔已到期</span><strong>全部领取</strong><BankProductIcon kind="next" /></button>
        <div v-if="!deposits.length && !investments.length" class="bank-empty-state"><BankProductIcon kind="positions" /><h3>暂无持有</h3><button type="button" class="bank-secondary-button" @click="$emit('browse')">查看存单</button></div>
        <div v-if="deposits.length" class="bank-position-group">
            <header class="bank-section-heading"><h3>定期存单 <small>{{ deposits.length }}</small></h3></header>
            <article v-for="position in deposits" :key="position.id" class="bank-position-card">
                <header><span class="bank-product-mark"><BankProductIcon kind="deposit" /></span><h4>{{ position.name }}</h4><span class="bank-position-status" :class="{ 'is-due': position.claimable }">{{ position.statusLabel }}</span></header>
                <dl class="bank-position-amounts"><div><dt>存入本金</dt><dd>¤ {{ position.principal.toLocaleString('zh-CN') }}</dd></div><div><dt>到期到账</dt><dd>¤ {{ position.maturityAmount.toLocaleString('zh-CN') }}</dd></div></dl>
                <footer v-if="!position.claimable"><span>现在支取到账 ¤ {{ position.earlyWithdrawalAmount.toLocaleString('zh-CN') }}</span><button type="button" class="bank-text-button is-loss" :disabled="Boolean(writeDisabledReason)" @click="$emit('withdraw', position)">提前支取</button></footer>
            </article>
        </div>
        <div v-if="investments.length" class="bank-position-group">
            <header class="bank-section-heading"><h3>浮动理财 <small>{{ investments.length }}</small></h3></header>
            <article v-for="position in investments" :key="position.id" class="bank-position-card">
                <header><span class="bank-product-mark"><BankProductIcon kind="fund" /></span><h4>{{ position.name }}</h4><span class="bank-position-status" :class="{ 'is-due': position.claimable }">{{ position.statusLabel }}</span></header>
                <div class="bank-fund-principal"><span>{{ position.riskLabel }} · 申购本金</span><strong>¤ {{ position.principal.toLocaleString('zh-CN') }}</strong></div>
                <div v-if="position.claimable" class="bank-fund-result" :class="{ 'is-negative': position.resolvedReturnBps < 0 }"><span>到期结果已揭晓</span><strong>{{ position.returnLabel }}</strong><small>可领取 ¤ {{ position.settlementAmount.toLocaleString('zh-CN') }}</small></div>
                <div v-else class="bank-sealed-copy"><BankProductIcon kind="lock" /><p>收益到期揭晓，锁定期间不可退出。</p></div>
            </article>
        </div>
    </section>
</template>
