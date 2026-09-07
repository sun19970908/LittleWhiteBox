<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ identity: string; name: string; small?: boolean }>();
// Identity, never row position: search, reordering and navigation keep one face.
const hue = computed(() => {
    let hash = 0;
    for (const char of props.identity) {hash = (Math.imul(hash, 31) + char.codePointAt(0)!) | 0;}
    return String((hash >>> 0) % 360);
});
</script>
<template><span class="messages-avatar" :class="{ small }" :style="{ '--avatar-hue': hue }" aria-hidden="true">{{ Array.from(name)[0] }}</span></template>
