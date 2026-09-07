<script setup lang="ts">
import { computed, useId } from 'vue';
import ShopItemIcon from './ShopItemIcon.vue';
const props = defineProps<{ name: string }>();
const id = useId();
const tones: Record<string, readonly [string, string, string]> = {
    local_florist: ['#ed6b8d', '#ffd2df', '#b33d64'], card_giftcard: ['#f07856', '#ffc4a7', '#c74d37'],
    sentiment_satisfied: ['#edbe48', '#fff0ac', '#ba8625'], star: ['#dcae3d', '#ffeb9f', '#a37825'],
    eco: ['#58a872', '#b9e5bf', '#287c56'], healing: ['#64a8d9', '#cfedff', '#337cb6'],
    ink_eraser: ['#ed8c9d', '#ffdae1', '#bf536e'], badge: ['#5e9cbf', '#c4e8ff', '#366e9d'],
    theater_comedy: ['#aa7ace', '#e8d5ff', '#7550aa'], lab_research: ['#4aaa91', '#b7f1dd', '#257c65'],
    photo_camera: ['#607a9e', '#cbdaf1', '#334d73'], handshake: ['#dfa64c', '#ffe0a3', '#a9722e'],
    visibility_off: ['#8874c4', '#d5c7ff', '#594394'], gavel: ['#ba8746', '#f5d39a', '#87552e'],
    auto_awesome: ['#e0ad43', '#ffe6a3', '#ac7a24'], forum: ['#479eb7', '#beecf4', '#28728f'],
    spa: ['#83b567', '#daf0b7', '#538743'], face: ['#d3b29b', '#fce5d5', '#a27f68'],
    switch_account: ['#9281ca', '#e0d8ff', '#6451a2'], medical_services: ['#d77c80', '#ffd4d6', '#a74755'],
    timer_off: ['#d7a945', '#ffeba8', '#9f742a'], door_sliding: ['#5c9bb9', '#c8eaff', '#326b94'],
    near_me: ['#d8ab69', '#ffe8c1', '#a37942'], shield_moon: ['#648bc8', '#ccddff', '#3e65a8'],
    thunderstorm: ['#549dbb', '#c3efff', '#317996'],
};
const tone = computed(() => tones[props.name] ?? tones.auto_awesome);
const bottle = computed(() => ['healing', 'lab_research', 'medical_services'].includes(props.name));
const card = computed(() => ['badge', 'switch_account', 'forum', 'gavel', 'handshake'].includes(props.name));
</script>
<template>
    <svg class="shop-item-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false" :style="{ '--item-color': tone[0], '--item-light': tone[1], '--item-dark': tone[2] }">
        <defs>
            <linearGradient :id="`${id}-body`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--item-light)" /><stop offset=".5" stop-color="var(--item-color)" /><stop offset="1" stop-color="var(--item-dark)" /></linearGradient>
            <linearGradient :id="`${id}-metal`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff2bc" /><stop offset=".46" stop-color="#e7bd62" /><stop offset="1" stop-color="#b18a3d" /></linearGradient>
            <linearGradient :id="`${id}-glass`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".9" /><stop offset=".5" stop-color="var(--item-light)" stop-opacity=".8" /><stop offset="1" stop-color="var(--item-color)" stop-opacity=".9" /></linearGradient>
        </defs>
        <ellipse cx="80" cy="136" rx="39" ry="6" fill="var(--item-dark)" opacity=".12" />
        <g class="shop-art-object" stroke-linecap="round" stroke-linejoin="round" :fill="`url(#${id}-body)`">
            <g v-if="name === 'local_florist'" transform="rotate(-9 80 80)">
                <path d="m45 66 34 64 37-64-34 20Z" fill="#ffeddb" stroke="#d7bda7" stroke-width="1.5" />
                <path d="m51 65 32 22-5 43m5-43 28-25" fill="none" stroke="#fbecd0" stroke-width="3" />
                <path d="M77 107 65 49m15 57 15-58M77 86c-25-2-27-20-27-20 24-2 29 18 29 18m3-8c2-19 22-17 22-17-2 16-22 17-22 17" fill="#70b784" stroke="#499965" stroke-width="2" />
                <g fill="#ed839e"><circle cx="61" cy="42" r="10" /><circle cx="72" cy="40" r="10" /><circle cx="77" cy="50" r="10" /><circle cx="68" cy="59" r="10" /><circle cx="57" cy="54" r="10" /></g>
                <circle cx="66" cy="50" r="7" fill="#f2d792" />
                <g fill="#ffd8bb"><circle cx="88" cy="39" r="8" /><circle cx="99" cy="39" r="8" /><circle cx="103" cy="49" r="8" /><circle cx="92" cy="54" r="8" /><circle cx="85" cy="47" r="8" /></g>
                <circle cx="95" cy="46" r="6" fill="#d5ad61" />
                <path d="m67 107 24 1m-11 0c-29-21-24 13-1 3 27 10 26-19 1-3m-1 3-9 13m11-14 10 11" fill="none" stroke="#d8546e" stroke-width="4" />
            </g>
            <g v-else-if="name === 'card_giftcard'" transform="rotate(-8 80 80)">
                <rect x="38" y="65" width="85" height="65" rx="9" /><path d="M91 70v60h14V70" fill="#7d4840" opacity=".42" />
                <rect x="33" y="55" width="95" height="24" rx="5" :fill="`url(#${id}-body)`" stroke="#b77551" />
                <path d="M76 54h15v76H76Z" fill="#e9d2a1" /><path d="M82 56C47 51 47 18 69 30c10 6 12 15 13 26Zm1 0c38-9 41-40 19-28-10 6-17 15-19 28Z" :fill="`url(#${id}-metal)`" stroke="#b79661" stroke-width="2" />
                <path d="m51 81 14 17 8-16" fill="#f5e1bd" /><circle cx="64" cy="87" r="2" fill="#b87e56" />
            </g>
            <g v-else-if="bottle" transform="rotate(8 80 80)">
                <rect x="63" y="27" width="34" height="21" rx="4" fill="#b6976e" /><path d="M69 28v14m9-14v14m9-14v14" stroke="#e0c49a" stroke-width="2" />
                <path d="M61 45h38v20c0 6 22 14 22 30v21c0 11-8 17-18 17H57c-10 0-18-6-18-17V95c0-16 22-24 22-30Z" :fill="`url(#${id}-glass)`" stroke="var(--item-color)" stroke-width="1.5" />
                <path d="M43 94c25-9 48 9 74 0v21q0 14-17 14H60q-17 0-17-14Z" opacity=".85" />
                <path d="M54 77q-9 8-9 17v18" stroke="#fffae9" stroke-width="4" fill="none" />
                <rect x="59" y="87" width="43" height="32" rx="4" fill="#fff9ee" transform="rotate(-5 80 103)" />
                <path v-if="name === 'medical_services'" d="M77 95h7v8h8v7h-8v8h-7v-8h-8v-7h8Z" fill="var(--item-dark)" transform="translate(0 -4)" />
                <path v-else-if="name === 'lab_research'" d="m80 94 11 9-11 10-11-10Z" fill="var(--item-dark)" />
                <path v-else d="M70 102q10-12 20 0-10 13-20 0Z" fill="none" stroke="var(--item-dark)" stroke-width="2" />
            </g>
            <g v-else-if="name === 'eco'">
                <path d="m48 73 65-6-5 65H54Z" fill="#c2a57d" stroke="#967d5c" stroke-width="1.5" /><rect x="46" y="68" width="69" height="14" rx="4" fill="#e3caa2" />
                <path d="M81 73V48m0 14c-25 0-32-20-27-25 25-1 28 26 28 26m0-8c1-29 25-34 31-29 4 27-31 33-31 33" stroke="#527750" stroke-width="2" /><path d="m58 95 42-4-3 29-37 3Z" fill="#f4e8cb" /><path d="M70 110q8-15 18-12-1 14-18 12" fill="#668960" />
            </g>
            <g v-else-if="name === 'ink_eraser'" transform="rotate(-20 80 80)">
                <path d="m36 59 72-13 22 33-17 40-72 2-15-27Z" stroke="var(--item-dark)" stroke-width="1.5" />
                <path d="m36 59 12 31 82-11-22-33" fill="var(--item-light)" /><path d="m63 54 13 33-8 33 28-1 10-36-19-33Z" fill="#f4e9cf" />
                <path d="m81 63 11 1m-9 6 11 1" stroke="#b59b83" stroke-width="2" /><path d="m48 90-7 31" stroke="var(--item-dark)" stroke-width="1.5" />
            </g>
            <g v-else-if="card" transform="rotate(-9 80 80)">
                <rect x="35" y="36" width="86" height="96" rx="9" fill="var(--item-dark)" /><rect x="41" y="30" width="86" height="96" rx="9" stroke="var(--item-dark)" stroke-width="1.3" />
                <rect x="48" y="37" width="72" height="82" rx="5" fill="none" stroke="var(--item-light)" stroke-width="1" />
                <circle cx="84" cy="70" r="23" fill="#f4e8c9" /><ShopItemIcon :name="name" x="66" y="51" width="36" height="36" class="shop-art-glyph" />
                <path d="M63 102h41m-33 7h25" stroke="#f6e4bd" stroke-width="2" /><circle cx="109" cy="45" r="2" fill="#fff5db" />
            </g>
            <g v-else-if="name === 'photo_camera'" transform="rotate(-7 80 80)">
                <path d="M44 62V49h27l10 13" fill="#b6b49d" /><rect x="26" y="58" width="108" height="70" rx="13" stroke="#4a6262" stroke-width="2" />
                <path d="M28 76h104v30H28Z" fill="#3c5451" /><circle cx="82" cy="93" r="28" fill="#c3b999" /><circle cx="82" cy="93" r="21" fill="#385254" /><circle cx="82" cy="93" r="14" fill="#789b9a" /><path d="M76 82q13-2 15 9" fill="none" stroke="#d8e6d6" stroke-width="4" /><rect x="111" y="67" width="13" height="7" rx="2" fill="#e8d9ac" />
            </g>
            <g v-else-if="name === 'visibility_off'">
                <path d="M80 27c-22 0-33 25-34 44l-20 55c34 14 74 14 108 0l-20-55c-1-19-12-44-34-44Z" stroke="var(--item-dark)" stroke-width="2" /><path d="M80 39c-16 0-24 18-24 30q24 18 48 0c0-12-8-30-24-30Z" fill="var(--item-dark)" /><path d="M76 86 65 127m18-38 14 39" stroke="var(--item-light)" opacity=".45" fill="none" stroke-width="2" /><circle cx="80" cy="83" r="5" fill="#e7d09a" /><path d="m34 73 6-8m82-18 5-7" stroke="#b7a77e" stroke-width="2" />
            </g>
            <g v-else-if="name === 'timer_off'" transform="rotate(10 80 80)">
                <circle cx="80" cy="29" r="10" fill="none" stroke="#b19158" stroke-width="6" /><rect x="72" y="36" width="16" height="12" rx="3" fill="#c3a469" /><circle cx="80" cy="89" r="45" :fill="`url(#${id}-metal)`" stroke="#9e804b" stroke-width="2" /><circle cx="80" cy="89" r="35" fill="#fffbf1" stroke="#9e804b" /><path d="M80 59v6m0 48v6M50 89h6m48 0h6m-9-21-4 4m-38-4 4 4m38 38-4-4m-38 4 4-4" stroke="#a59470" stroke-width="2" /><path d="M80 70v19l14 12" fill="none" stroke="#685d47" stroke-width="3" /><circle cx="80" cy="89" r="4" fill="#b3955a" /><path d="M49 65q17-24 43-13" fill="none" stroke="#fff6d3" stroke-width="3" />
            </g>
            <g v-else-if="name === 'door_sliding'">
                <path d="M42 132V65a38 38 0 0 1 76 0v67Z" stroke="var(--item-dark)" stroke-width="2" /><path d="M51 125V65a29 29 0 0 1 58 0v60Z" fill="#e0e6db" /><path d="M79 40v85h27V66a29 29 0 0 0-27-26Z" fill="#547283" /><path d="m54 125 25-85v85Z" fill="#f6ebc9" /><path d="M36 133h88" stroke="#ae9a75" stroke-width="7" /><circle cx="88" cy="89" r="3" fill="#e5cf9b" /><path d="m58 62 6-9m36 15 2-9" stroke="#fffae6" stroke-width="2" />
            </g>
            <g v-else-if="name === 'near_me'" transform="rotate(12 80 80)">
                <path d="m51 30 58 0-4 105-25-12-26 12Z" fill="#efe0b9" stroke="#bea275" stroke-width="2" /><rect x="56" y="38" width="48" height="12" rx="2" fill="#bba073" /><path d="m65 70 28-9-10 31-4-15Z" fill="#a9664c" /><path d="m78 94-4 13m8-9 3 13m-24 4h33" fill="none" stroke="#a9664c" stroke-width="3" />
            </g>
            <g v-else-if="name === 'shield_moon'">
                <path d="m80 28 44 17v39c0 29-22 45-44 53-22-8-44-24-44-53V45Z" stroke="#65717f" stroke-width="2" /><path d="m80 37 35 14v33c0 23-15 36-35 44-20-8-35-21-35-44V51Z" fill="none" stroke="#c1ced6" /><path d="M91 56a24 24 0 1 0 12 40 28 28 0 0 1-12-40Z" :fill="`url(#${id}-metal)`" /><path d="m101 57 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#eddfb4" />
            </g>
            <g v-else-if="name === 'thunderstorm'">
                <path d="M58 35h44v8H58Z" fill="#9b825f" /><path d="M62 43h36v17c0 9 24 12 24 35a42 42 0 0 1-84 0c0-23 24-26 24-35Z" :fill="`url(#${id}-glass)`" stroke="var(--item-color)" stroke-width="1.5" /><path d="M51 87c-4-13 15-21 24-13 7-16 33-10 31 5 15 3 13 21 1 21H60c-11 0-17-8-9-13Z" fill="#eff0e2" /><path d="m75 104-9 15m21-15-9 15m20-15-9 15" stroke="#598392" stroke-width="3" /><path d="M49 110q-7-11-1-25" stroke="#fffbe5" stroke-width="3" fill="none" />
            </g>
            <g v-else-if="name === 'theater_comedy'" transform="rotate(-10 80 80)">
                <path d="M50 35q30 9 60 0v50q-6 36-30 44-24-8-30-44Z" stroke="var(--item-dark)" stroke-width="2" /><path d="M80 41v82q21-9 25-37V42Z" fill="var(--item-dark)" opacity=".45" /><path d="m59 66 11 2m20-1 10-5M65 97q13 12 28-1" fill="none" stroke="#f9ecd5" stroke-width="4" />
            </g>
            <g v-else-if="name === 'spa'">
                <path d="M80 127C32 123 31 83 33 75c28 0 42 20 47 40 5-20 19-40 47-40 2 8 1 48-47 52Z" stroke="var(--item-dark)" stroke-width="1.5" /><path d="M80 122c-32-25-25-62 0-92 25 30 32 67 0 92Z" fill="var(--item-light)" stroke="var(--item-color)" stroke-width="1.5" /><path d="M80 56v65m-34-33 33 33 33-33" stroke="#779061" stroke-width="2" fill="none" /><ellipse cx="80" cy="134" rx="44" ry="4" fill="#c8ac76" />
            </g>
            <g v-else-if="name === 'face'">
                <path d="M44 66q0-37 36-37t36 37v27c-3 24-23 38-36 40-13-2-33-16-36-40Z" stroke="var(--item-dark)" stroke-width="1.5" /><path d="M57 76h12m23 0h12M80 74l-4 20h9m-19 14q14 6 28 0" fill="none" stroke="var(--item-dark)" stroke-width="3" /><path d="M54 53q8-16 27-17" fill="none" stroke="#f7e7cf" stroke-width="4" />
            </g>
            <g v-else-if="name === 'sentiment_satisfied'" transform="rotate(-12 80 80)">
                <rect x="36" y="30" width="91" height="101" rx="9" fill="#fff8da" /><circle cx="81" cy="78" r="34" stroke="#ba994e" stroke-width="1.5" /><path d="M61 71q6-8 12 0m15 0q6-8 12 0M65 87q16 17 32 0" fill="none" stroke="#76602f" stroke-width="3.5" /><path d="m103 116 21-18v24q-10 11-21-6" fill="#eddb9c" /><path d="M52 40h20" stroke="#fff9e6" stroke-width="3" />
            </g>
            <g v-else>
                <circle cx="80" cy="81" r="45" fill="none" :stroke="`url(#${id}-metal)`" stroke-width="7" /><circle cx="80" cy="81" r="37" :fill="`url(#${id}-glass)`" /><path d="m80 42 11 25 27 4-20 19 5 28-23-14-23 14 5-28-20-19 27-4Z" stroke="#9f834c" stroke-width="1.5" /><path d="m80 53 0 40 25-19-23-4" fill="#fff0c3" opacity=".7" /><path v-if="name === 'auto_awesome'" d="m126 27 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm-94 71 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#d4b778" />
            </g>
        </g>
    </svg>
</template>
