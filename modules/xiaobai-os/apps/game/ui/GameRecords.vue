<script setup lang="ts">
import { gameRoom } from './room-catalog.js';
import type { GameRecordView } from '../types.js';

defineProps<{
    records: GameRecordView[];
    total: number;
    hasMore: boolean;
    loadingMore: boolean;
    error: string;
}>();

defineEmits<{
    loadMore: [];
}>();

function formatTime(value: number): string {
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}
</script>

<template>
    <section class="game-records" aria-labelledby="game-records-title">
        <header class="game-section-heading">
            <div>
                <h2 id="game-records-title">记录</h2>
            </div>
            <small>{{ total }} 局</small>
        </header>

        <div v-if="records.length" class="game-record-list">
            <article
                v-for="record in records"
                :key="record.id"
                class="game-record"
                :class="`is-${record.outcomeTone}`"
            >
                <div class="game-record-mark" aria-hidden="true">{{ gameRoom(record.game).mark }}</div>
                <div class="game-record-main">
                    <header>
                        <div>
                            <span>{{ record.gameLabel }}</span><strong>{{ record.outcomeLabel }}</strong>
                        </div>
                        <time :datetime="new Date(record.createdAt).toISOString()">{{
                            formatTime(record.createdAt)
                        }}</time>
                    </header>
                    <div class="game-record-money">
                        <span>下注 ¤ {{ record.amountIn }}</span>
                        <span>拿回 ¤ {{ record.payout }}</span>
                        <strong>{{ record.net > 0 ? '+' : '' }}{{ record.net }}</strong>
                    </div>
                    <details>
                        <summary>本局详情</summary>
                        <component :is="gameRoom(record.game).record" :detail="record.detail" />
                    </details>
                </div>
            </article>
        </div>
        <div v-else class="game-record-empty">
            <span aria-hidden="true">◇</span>
            <p>暂无游戏记录</p>
        </div>

        <p v-if="error" class="game-inline-error" role="status">{{ error }}</p>
        <button
            v-if="hasMore"
            type="button"
            class="game-load-more"
            :disabled="loadingMore"
            @click="$emit('loadMore')"
        >
            {{ loadingMore ? '正在翻阅…' : '更多记录' }}
        </button>
    </section>
</template>
