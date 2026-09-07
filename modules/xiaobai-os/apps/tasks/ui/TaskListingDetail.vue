<script setup lang="ts">
import type { TaskBoardPresentation } from '../types.js';
import TaskIcon from './TaskIcon.vue';
import { taskMoney } from './task-display.js';
defineProps<{ listing: TaskBoardPresentation['listings'][number] | null; busy: boolean; disabledReason: string }>();
defineEmits<{ accept: [] }>();
</script>
<template>
    <section class="tasks-page">
        <template v-if="listing">
            <article class="tasks-contract-sheet">
                <header class="tasks-contract-heading"><span class="tasks-grade">{{ listing.grade }}</span><span class="tasks-eyebrow">任务终端 · {{ listing.posture }}</span><h2>{{ listing.title }}</h2><p>{{ listing.hook }}</p></header>
                <div class="tasks-contract-reward"><span>完成报酬<strong><small>¤</small> {{ taskMoney(listing.reward) }}</strong></span><span class="tasks-seal"><TaskIcon name="check" />终端出资</span></div>
                <dl class="tasks-facts"><div><dt>完成目标</dt><dd>{{ listing.objective }}</dd></div><div v-if="listing.requirements"><dt>执行约束</dt><dd>{{ listing.requirements }}</dd></div><div><dt>行动地点</dt><dd>{{ listing.location }}</dd></div><div><dt>行动时机</dt><dd>{{ listing.timing }}</dd></div><div class="is-risk"><dt>留意风险</dt><dd>{{ listing.risk }}</dd></div></dl>
                <div class="tasks-tags"><span v-for="tag in listing.tags" :key="tag">{{ tag }}</span></div>
            </article>
            <p class="tasks-hint">接取后由你执行，报酬自动托管；无需另找 NPC 领取任务。</p>
            <div class="tasks-action-dock"><p v-if="disabledReason" class="tasks-hint">{{ disabledReason }}</p><button type="button" class="tasks-primary-button" :disabled="listing.accepted || busy || Boolean(disabledReason)" @click="$emit('accept')"><TaskIcon :name="listing.accepted ? 'check' : 'plus'" />{{ listing.accepted ? '已接取这份委托' : busy ? '正在接取…' : '接下这份委托' }}</button></div>
        </template>
        <div v-else class="tasks-empty"><TaskIcon name="ticket" /><h3>这批委托已更新</h3><p>返回大厅，查看最新的委托。</p></div>
    </section>
</template>
