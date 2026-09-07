<script setup lang="ts">
import type { TaskRecord } from '../types.js';
import TaskIcon from './TaskIcon.vue';
import { taskMoney, taskStatusLabel } from './task-display.js';
defineProps<{ task: TaskRecord }>();
defineEmits<{ open: [task: TaskRecord] }>();
</script>
<template>
    <button type="button" class="tasks-record" :data-navigation-id="`task:${task.taskId}`" @click="$emit('open', task)">
        <span class="tasks-record-top"><span class="tasks-status" :data-status="task.status"><i />{{ taskStatusLabel[task.status] }}</span><span class="tasks-reward"><small>¤</small> {{ taskMoney(task.reward) }}</span></span>
        <strong class="tasks-record-title">{{ task.title }}</strong>
        <span class="tasks-record-summary">{{ task.resultSummary || task.progressSummary || (task.status === 'recruiting' ? '委托已发布，等待你选择执行者。' : '任务已开始，等待新的进展。') }}</span>
        <span class="tasks-record-foot"><span><TaskIcon :name="task.source === 'received' ? 'pin' : 'people'" />{{ task.source === 'received' ? task.location : task.assignee?.displayName || `${task.candidates.length} 位候选人` }}</span><TaskIcon name="next" /></span>
    </button>
</template>
