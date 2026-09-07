<script setup lang="ts">
import type { BankActivityView } from '../types.js';
import BankProductIcon from './BankProductIcon.vue';
defineProps<{ activities: BankActivityView[]; total: number; hasMore: boolean; loadingMore: boolean; error: string }>();
defineEmits<{ loadMore: [] }>();
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
</script>
<template>
    <section class="bank-page" aria-labelledby="bank-records-title">
        <header class="bank-page-heading"><h2 id="bank-records-title">兑付记录 <small>{{ total }} 笔</small></h2></header>
        <div v-if="!activities.length" class="bank-empty-state"><BankProductIcon kind="records" /><h3>暂无兑付记录</h3></div>
        <div v-else class="bank-record-list">
            <details v-for="activity in activities" :key="activity.id" class="bank-record-row">
                <summary><span class="bank-product-mark"><BankProductIcon :kind="activity.kind" /></span><span class="bank-record-main"><strong>{{ activity.productName }}</strong><small>{{ activity.resultLabel }}</small></span><span class="bank-record-net" :class="{ 'is-negative': activity.net < 0, 'is-flat': activity.net === 0 }"><strong>{{ activity.net > 0 ? '+' : '' }}{{ activity.net.toLocaleString('zh-CN') }}</strong><small>{{ activity.net < 0 ? '净损失' : activity.net > 0 ? '净收益' : '持平' }}</small></span><BankProductIcon kind="next" /></summary>
                <dl class="bank-record-detail"><div><dt>投入本金</dt><dd>¤ {{ activity.amountIn.toLocaleString('zh-CN') }}</dd></div><div><dt>实际到账</dt><dd>¤ {{ activity.payout.toLocaleString('zh-CN') }}</dd></div><div><dt>结算回合</dt><dd>{{ activity.turnLabel }}</dd></div><div><dt>发生时间</dt><dd>{{ dateFormatter.format(activity.createdAt) }}</dd></div></dl>
            </details>
        </div>
        <p v-if="error" class="bank-inline-error" role="alert">{{ error }}</p>
        <button v-if="hasMore" type="button" class="bank-secondary-button bank-full-button bank-load-more" :disabled="loadingMore" @click="$emit('loadMore')">{{ loadingMore ? '正在读取…' : '查看更早的记录' }}</button>
    </section>
</template>
