<script setup lang="ts">
defineProps<{ name: 'shop' | 'bag' | 'spark' | 'search' | 'back' | 'next' | 'close' | 'refresh' | 'check' | 'clock' | 'lock' }>();
const paths = {
    shop: 'M4 10v11h16V10M3 10l2-7h14l2 7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0M9 21v-7h6v7M8 3v7m8-7v7',
    bag: 'M5 7h14l2 14H3L5 7Zm3 1V6a4 4 0 0 1 8 0v2',
    spark: 'm12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z',
    search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    back: 'm14 5-7 7 7 7', next: 'm9 5 7 7-7 7', close: 'm6 6 12 12M6 18 18 6',
    refresh: 'M20 3v6h-6M4 21v-6h6M20 9A8 8 0 0 0 6 6l-2 3m16 6-2 3A8 8 0 0 1 4 15',
    check: 'm5 12 4 4L19 6', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    lock: 'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4M12 14v3',
};
</script>
<template>
    <svg class="shop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name]" /></svg>
</template>
