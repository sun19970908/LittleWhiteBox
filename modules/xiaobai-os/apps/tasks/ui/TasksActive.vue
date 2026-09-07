<script setup lang="ts">
import type { TaskRecord } from '../types.js';
import TaskRecordCard from './TaskRecordCard.vue';
import TaskIcon from './TaskIcon.vue';
defineProps<{ records: TaskRecord[] }>();
defineEmits<{ detail: [taskId: string]; discover: [] }>();
</script>
<template>
    <section class="tasks-page">
        <header class="tasks-section-heading"><h2>我接的</h2><small v-if="records.length">{{ records.length }} 项</small></header>
        <div v-if="!records.length" class="tasks-empty"><TaskIcon name="compass" /><h3>暂无进行中的委托</h3><button type="button" class="tasks-primary-button" @click="$emit('discover')">发现委托</button></div>
        <div v-else class="tasks-record-list"><TaskRecordCard v-for="task in records" :key="task.taskId" :task="task" @open="$emit('detail', task.taskId)" /></div>
    </section>
</template>
