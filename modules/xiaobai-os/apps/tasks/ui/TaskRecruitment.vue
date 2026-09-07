<script setup lang="ts">
import type { TaskRecord } from '../types.js';
import TaskCandidateList from './TaskCandidateList.vue';
import TaskIcon from './TaskIcon.vue';
import { taskMoney } from './task-display.js';
defineProps<{ task: TaskRecord | null; busy: boolean; recruiting: boolean; disabledReason: string; generationDisabledReason: string }>();
defineEmits<{ recruit: [task: TaskRecord]; assign: [task: TaskRecord, candidateId: string]; cancel: [task: TaskRecord]; detail: [taskId: string] }>();
</script>
<template>
    <section class="tasks-page">
        <template v-if="task">
            <header class="tasks-recruit-heading"><span class="tasks-eyebrow">报酬已托管</span><h2>{{ task.title }}</h2><div><strong class="tasks-reward">¤ {{ taskMoney(task.reward) }}</strong><button type="button" class="tasks-text-button" data-navigation-id="contract" @click="$emit('detail', task.taskId)">查看委托内容<TaskIcon name="next" /></button></div></header>
            <template v-if="task.status === 'recruiting'">
                <header class="tasks-section-heading"><h3>选择执行者 <small>{{ task.candidates.length }}</small></h3><button type="button" class="tasks-text-button" :disabled="busy || recruiting || Boolean(generationDisabledReason)" @click="$emit('recruit', task)"><TaskIcon name="refresh" :class="{ 'is-spinning': recruiting }" />{{ recruiting ? '招募中…' : task.candidates.length ? '重新招募' : '开始招募' }}</button></header>
                <p class="tasks-hint" :role="recruiting ? 'status' : undefined">{{ recruiting ? '正在招募，可离开页面等待。' : '招募将调用模型' }}</p>
                <p v-if="disabledReason || generationDisabledReason" class="tasks-hint">{{ disabledReason || generationDisabledReason }}</p>
                <TaskCandidateList :task="task" :busy="busy || recruiting" :disabled-reason="disabledReason" @assign="(record, id) => $emit('assign', record, id)" />
                <div class="tasks-withdraw"><button type="button" class="tasks-text-button is-danger" :disabled="busy || Boolean(disabledReason)" @click="$emit('cancel', task)">取消委托并退回报酬</button></div>
            </template>
            <div v-else class="tasks-empty"><TaskIcon name="check" /><h3>{{ task.status === 'active' ? '执行者已接下委托' : '这份委托已结束' }}</h3><button type="button" class="tasks-primary-button" @click="$emit('detail', task.taskId)">查看任务进展</button></div>
        </template>
        <div v-else class="tasks-empty"><h3>委托状态已更新</h3><p>请返回“我发布”查看最新进展或已结束记录。</p></div>
    </section>
</template>
