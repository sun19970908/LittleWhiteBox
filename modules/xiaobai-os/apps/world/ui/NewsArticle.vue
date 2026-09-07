<script setup lang="ts">
import { computed } from 'vue';
import type { WorldNews } from '../../../domains/world/types.js';

const props = defineProps<{ article: WorldNews; update: 'same' | 'updated' | 'removed' }>();
defineEmits<{ latest: [] }>();
const paragraphs = computed(() => props.article.body.split(/\n\s*\n|\n/).map(text => text.trim()).filter(Boolean));
</script>

<template>
    <article class="world-article">
        <h1 tabindex="-1">{{ article.title }}</h1>
        <div v-if="update !== 'same'" class="world-article-update" role="status">
            <template v-if="update === 'updated'">
                <span>这篇见闻有了新内容</span>
                <button type="button" @click="$emit('latest')">阅读新版</button>
            </template>
            <span v-else>这篇已不在当前列表，仍可读完。</span>
        </div>
        <div class="world-article-body">
            <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
        </div>
    </article>
</template>
