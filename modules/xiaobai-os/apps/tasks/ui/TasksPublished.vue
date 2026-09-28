<script setup lang="ts">
import type { OwnedCommission } from '../types.js';
import TaskRecordCard from './TaskRecordCard.vue';
import TaskIcon from './TaskIcon.vue';
defineProps<{ records: OwnedCommission[]; disabledReason: string }>();
defineEmits<{ open: [commission: OwnedCommission]; publish: []; history: [] }>();
</script>
<template>
    <section class="tasks-page">
        <header class="tasks-section-heading"><h2>我发布的</h2><button type="button" class="tasks-primary-button" data-navigation-id="publish" :disabled="Boolean(disabledReason)" @click="$emit('publish')"><TaskIcon name="plus" />发布委托</button></header>
        <p v-if="disabledReason" class="tasks-hint">{{ disabledReason }}</p>
        <div v-if="!records.length" class="tasks-empty"><TaskIcon name="send" /><h3>还没有发布委托</h3></div>
        <div v-else class="tasks-record-list"><TaskRecordCard v-for="commission in records" :key="`${commission.scopeId}:${commission.task.taskId}`" :task="commission.task" :source-label="commission.sourceLabel" @open="$emit('open', commission)" /></div>
        <button type="button" class="tasks-text-button tasks-history-link" @click="$emit('history')">已结束的委托<TaskIcon name="next" /></button>
    </section>
</template>
