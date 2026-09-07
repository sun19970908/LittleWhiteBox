<script setup lang="ts">
import TaskIcon from './TaskIcon.vue';
defineProps<{ autoMaintenance: boolean; settingsBusy: boolean; maintenanceBusy: boolean; maintenanceMessage: string; disabledReason: string }>();
defineEmits<{ update: [enabled: boolean]; maintain: [] }>();
</script>
<template>
    <section class="tasks-page tasks-settings-page">
        <article class="tasks-setting-card"><div class="tasks-setting-row"><h3>自动更新进展</h3><label class="tasks-switch"><input type="checkbox" aria-label="自动更新任务进展" :checked="autoMaintenance" :disabled="settingsBusy" @change="$emit('update', ($event.target as HTMLInputElement).checked)"><span /></label></div><p>发送下一条消息时，根据上一轮剧情更新任务，将调用模型。适用于所有普通聊天。</p></article>
        <article class="tasks-setting-card"><button type="button" class="tasks-secondary-button" :disabled="maintenanceBusy || Boolean(disabledReason)" @click="$emit('maintain')"><TaskIcon name="refresh" :class="{ 'is-spinning': maintenanceBusy }" />{{ maintenanceBusy ? '正在更新…' : '更新任务进展' }}</button><p>根据当前剧情检查任务，将调用模型。</p><p v-if="disabledReason" class="tasks-hint">{{ disabledReason }}</p></article>
        <p v-if="maintenanceMessage" class="tasks-maintenance-message" role="status">{{ maintenanceMessage }}</p>
    </section>
</template>
