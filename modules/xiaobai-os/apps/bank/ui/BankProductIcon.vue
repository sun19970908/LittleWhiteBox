<script setup lang="ts">
defineProps<{ kind: 'vault' | 'deposit' | 'fund' | 'records' | 'withdraw' | 'positions' | 'refresh' | 'next' | 'lock' | 'check' }>();
const paths = {
    vault: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 4h2m-2 10h2m7-9v8m-4-4h8',
    deposit: 'M5 3h11l3 3v15H5V3Zm11 0v3h3M8 9h8m-8 4h6m-6 4h4',
    fund: 'M4 20h16M5 16l5-5 4 3 5-8m-4 0h4v4',
    records: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8m-8 4h4',
    withdraw: 'M3 12h13m-4-4 4 4-4 4M19 4h2v16h-2',
    positions: 'M3 8h18v12H3V8Zm5 0V4h8v4M3 13h18M10 13v3h4v-3',
    refresh: 'M20 5v6h-6M4 19v-6h6M6 7a7 7 0 0 1 12-1l2 5M4 13l2 5a7 7 0 0 0 12-1',
    next: 'm9 5 7 7-7 7', lock: 'M5 10h14v11H5V10Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2',
    check: 'm5 12 4 4L19 6',
};
</script>
<template><svg class="bank-product-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[kind]" /><circle v-if="kind === 'vault'" cx="12" cy="12" r="6" /></svg></template>
