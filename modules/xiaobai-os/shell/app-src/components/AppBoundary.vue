<script setup lang="ts">
import { onErrorCaptured } from 'vue';

const emit = defineEmits<{
    failed: [error: unknown];
}>();

onErrorCaptured((error) => {
    emit('failed', error);
    return false;
});
</script>

<template>
    <slot />
</template>
