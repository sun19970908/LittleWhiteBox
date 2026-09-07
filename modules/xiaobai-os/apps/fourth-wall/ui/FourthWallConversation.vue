<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { XiaobaiOsFrameBridge } from '../../../shell/app-src/frame-bridge.js';
import FourthWallMessage from './FourthWallMessage.vue';
import type { FourthWallGenerationState, FourthWallMessageData } from '../types.js';

const props = defineProps<{
    history: FourthWallMessageData[];
    sessionId: string;
    chatIdentity: string;
    userAvatar: string;
    characterAvatar: string;
    imageAvailable: boolean;
    voiceAvailable: boolean;
    generation: FourthWallGenerationState;
    bridge: XiaobaiOsFrameBridge;
}>();

defineEmits<{
    edit: [messageIndex: number, content: string];
    delete: [messageIndex: number];
}>();

const viewport = ref<HTMLElement | null>(null);
const visibleLimit = ref(40);
const startIndex = computed(() => Math.max(0, props.history.length - visibleLimit.value));
const visibleHistory = computed(() => props.history.slice(startIndex.value));

function showEarlier(): void {
    visibleLimit.value = Math.min(props.history.length, visibleLimit.value + 40);
}

watch(() => props.sessionId, () => {
    visibleLimit.value = 40;
});

watch(() => [props.history.length, props.generation.text], async () => {
    await nextTick();
    if (viewport.value) {
        viewport.value.scrollTop = viewport.value.scrollHeight;
    }
}, { immediate: true });
</script>

<template>
    <section ref="viewport" class="fourth-wall-conversation" aria-live="polite">
        <button v-if="startIndex > 0" type="button" class="fourth-wall-earlier" @click="showEarlier">
            显示更早的 {{ startIndex }} 条记录
        </button>
        <div v-if="history.length === 0 && generation.status === 'idle'" class="fourth-wall-empty">
            <span>IV</span>
            <strong>越过故事边界</strong>
            <p>这里是你与角色扮演者的皮下私聊。</p>
        </div>
        <FourthWallMessage
            v-for="(message, offset) in visibleHistory"
            :key="`${message.ts}-${startIndex + offset}`"
            :message="message"
            :message-index="startIndex + offset"
            :chat-identity="chatIdentity"
            :session-id="sessionId"
            :user-avatar="userAvatar"
            :character-avatar="characterAvatar"
            :image-available="imageAvailable"
            :voice-available="voiceAvailable"
            :bridge="bridge"
            @edit="(index, content) => $emit('edit', index, content)"
            @delete="index => $emit('delete', index)"
        />
        <article v-if="generation.status !== 'idle'" class="fourth-wall-message is-ai is-streaming">
            <img v-if="characterAvatar" class="fourth-wall-avatar" :src="characterAvatar" alt="">
            <span v-else class="fourth-wall-avatar is-placeholder" />
            <div class="fourth-wall-message-stack">
                <details v-if="generation.thinking" class="fourth-wall-thinking" open>
                    <summary>思考中</summary>
                    <div>{{ generation.thinking }}</div>
                </details>
                <div class="fourth-wall-bubble">
                    {{ generation.text || (generation.status === 'error' ? generation.message : '等待回应...') }}
                    <small v-if="generation.unsaved" class="fourth-wall-unsaved">未保存</small>
                </div>
            </div>
        </article>
    </section>
</template>
