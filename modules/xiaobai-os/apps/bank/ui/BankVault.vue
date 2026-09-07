<script setup lang="ts">
import type { BankPage } from '../types.js';
import BankProductIcon from './BankProductIcon.vue';
defineProps<{ lockedAmount: number; currentTurn: number; depositCount: number; fundCount: number; claimableCount: number; writeDisabledReason: string }>();
defineEmits<{ navigate: [page: BankPage]; settle: [] }>();
</script>
<template>
    <section class="bank-vault bank-page" aria-labelledby="bank-vault-title">
        <header class="bank-assets"><h2 id="bank-vault-title">持有本金</h2><strong><small>¤</small> {{ lockedAmount.toLocaleString('zh-CN') }}</strong><p>不含未结算收益</p></header>
        <button type="button" class="bank-holding-link" @click="$emit('navigate', 'positions')"><span>存单 {{ depositCount }} 笔 · 理财 {{ fundCount }} 笔</span><strong>查看持有</strong><BankProductIcon kind="next" /></button>
        <button v-if="claimableCount" type="button" class="bank-claim-button" :disabled="Boolean(writeDisabledReason)" @click="$emit('settle')">
            <BankProductIcon kind="check" /><span>{{ claimableCount }} 笔已到期</span><strong>全部领取</strong><BankProductIcon kind="next" />
        </button>
        <div class="bank-vault-portals">
            <button type="button" class="bank-portal" @click="$emit('navigate', 'deposits')"><span class="bank-portal-mark"><BankProductIcon kind="deposit" /></span><span><strong>定期存单</strong><small>固定收益</small></span><BankProductIcon kind="next" /></button>
            <button type="button" class="bank-portal is-fund" @click="$emit('navigate', 'funds')"><span class="bank-portal-mark"><BankProductIcon kind="fund" /></span><span><strong>浮动理财</strong><small>收益浮动，可能损失本金</small></span><BankProductIcon kind="next" /></button>
        </div>
        <details class="bank-timing"><summary>计期与兑付</summary><p>当前第 {{ currentTurn }} 回合。每完成一条剧情回复推进一回合。到期资产可手动领取，也会随下一次银行交易一并结算至钱包。</p></details>
    </section>
</template>
