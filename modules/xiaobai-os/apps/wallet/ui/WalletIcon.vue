<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
    wallet: 'M4 6h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v2M20 11h-5v5h5M17 13.5h.1',
    refresh: 'M20 5v6h-6M4 19v-6h6M6 7a7 7 0 0 1 12-1l2 5M4 13l2 5a7 7 0 0 0 12-1',
    income: 'M12 4v16m-6-6 6 6 6-6', expense: 'M12 20V4m-6 6 6-6 6 6',
    transfer: 'M3 8h18m-5-5 5 5-5 5M21 16H3m5-5-5 5 5 5',
    shop: 'M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2',
    bank: 'M3 8h18L12 2 3 8Zm2 3v7m7-7v7m7-7v7M3 21h18',
    tasks: 'M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h3',
    game: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm1 4h.1m9.9 0h.1M12 12h.1M7 17h.1m9.9 0h.1',
    gift: 'M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13M12 8C2 8 7 0 12 8Zm0 0c10 0 5-8 0 0Z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
    next: 'm9 5 7 7-7 7', close: 'm6 6 12 12M6 18 18 6',
};
</script>
<template><svg class="wallet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name] || paths.receipt" /></svg></template>
