<script setup lang="ts">
import { reactive } from 'vue';
import type { MessagesSettings } from '../types.js';
import { messageSyncCopy } from '../sync-copy.js';
const props = defineProps<{ settings: MessagesSettings; busy: boolean }>();
const emit = defineEmits<{ save: [settings: MessagesSettings] }>();
const draft = reactive({ ...props.settings });
</script>
<template>
    <form class="messages-settings" @submit.prevent="emit('save', { ...draft })">
        <fieldset :disabled="busy">
            <legend>对方的回复</legend>
            <label><span>允许对方发图片</span><input v-model="draft.imagePrompt" type="checkbox"></label>
            <label><span>允许对方发语音</span><input v-model="draft.voicePrompt" type="checkbox"></label>
        </fieldset>
        <fieldset :disabled="busy">
            <legend>{{ messageSyncCopy.title }}</legend>
            <label><span>{{ messageSyncCopy.setting }}</span><input v-model="draft.syncNoticeEnabled" type="checkbox"></label>
        </fieldset>
        <button type="submit" class="messages-primary" :disabled="busy">{{ busy ? '请稍候…' : '保存设置' }}</button>
    </form>
</template>
