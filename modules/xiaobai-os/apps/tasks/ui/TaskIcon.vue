<script setup lang="ts">
defineProps<{ name: keyof typeof paths }>();
const paths = {
    compass: 'm14.5 9.5-2 5-5 2 2-5 5-2ZM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    send: 'm21 3-7 18-4-7-7-4 18-7ZM10 14 21 3',
    archive: 'M4 8h16v12H4V8ZM3 4h18v4H3V4Zm6 8h6',
    settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
    back: 'm14 5-7 7 7 7',
    next: 'm9 5 7 7-7 7',
    refresh: 'M20 7v5h-5M4 17v-5h5M18 9A7 7 0 0 0 6 7L4 9m16 6-2 2A7 7 0 0 1 6 15',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    check: 'm5 12 4 4L19 6',
    plus: 'M12 5v14M5 12h14',
    ticket: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6',
    people: 'M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 20v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
    close: 'm6 6 12 12M6 18 18 6',
};
</script>
<template>
    <svg class="tasks-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg>
</template>
