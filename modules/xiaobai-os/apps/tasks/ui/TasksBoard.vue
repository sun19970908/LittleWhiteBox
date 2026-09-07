<script setup lang="ts">
import type { TaskBoardPresentation } from '../types.js';
import TaskIcon from './TaskIcon.vue';
import { taskMoney } from './task-display.js';
defineProps<{ board: TaskBoardPresentation | null; busy: boolean; disabledReason: string }>();
defineEmits<{ refresh: []; detail: [boardId: string, listingId: string] }>();
</script>
<template>
    <section class="tasks-page tasks-board-page">
        <header class="tasks-section-heading"><h2>发现委托</h2><button v-if="board?.listings.length" type="button" class="tasks-text-button" :disabled="busy || Boolean(disabledReason)" @click="$emit('refresh')"><TaskIcon name="refresh" :class="{ 'is-spinning': busy }" />{{ busy ? '获取中…' : '换一批' }}</button></header>
        <p v-if="disabledReason" class="tasks-hint" role="status">{{ disabledReason }}</p>
        <div v-if="!board || !board.listings.length" class="tasks-empty"><TaskIcon name="compass" /><h3>{{ busy ? '正在获取委托…' : '暂无委托' }}</h3><button v-if="!busy" type="button" class="tasks-primary-button" :disabled="Boolean(disabledReason)" @click="$emit('refresh')">获取委托</button><p>获取委托将调用模型</p></div>
        <div v-else class="tasks-board-list" :aria-busy="busy">
            <button v-for="listing in board.listings" :key="listing.listingId" :data-navigation-id="`listing:${listing.listingId}`" type="button" class="tasks-ticket" :class="{ 'is-accepted': listing.accepted }" @click="$emit('detail', board.boardId, listing.listingId)">
                <span class="tasks-ticket-top"><span class="tasks-grade" :data-grade="listing.grade" :aria-label="`等级 ${listing.grade}`">{{ listing.grade }}</span><span class="tasks-ticket-tags">{{ listing.tags.slice(0, 2).join(' · ') }}</span><span class="tasks-reward" :aria-label="`报酬 ${taskMoney(listing.reward)} 小白币`"><small>¤</small> {{ taskMoney(listing.reward) }}</span></span>
                <strong class="tasks-ticket-title">{{ listing.title }}</strong><span class="tasks-ticket-hook">{{ listing.hook }}</span>
                <span class="tasks-ticket-foot"><span class="tasks-ticket-location"><TaskIcon name="pin" />{{ listing.location }}</span><span v-if="listing.accepted" class="tasks-accepted"><TaskIcon name="check" />已接取</span><TaskIcon v-else name="next" /></span>
            </button>
        </div>
        <p v-if="board?.listings.length" class="tasks-footnote">任务终端出资 · 换一批将调用模型</p>
    </section>
</template>
