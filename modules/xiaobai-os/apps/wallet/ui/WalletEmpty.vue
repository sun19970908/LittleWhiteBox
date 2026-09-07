<script setup lang="ts">
withDefaults(defineProps<{
    title: string;
    message?: string;
}>(), { message: '' });
</script>

<template>
    <div class="wallet-ui-empty">
        <span v-if="$slots.icon" class="wallet-ui-empty-icon" aria-hidden="true">
            <slot name="icon" />
        </span>
        <strong>{{ title }}</strong>
        <p v-if="message">{{ message }}</p>
    </div>
</template>
