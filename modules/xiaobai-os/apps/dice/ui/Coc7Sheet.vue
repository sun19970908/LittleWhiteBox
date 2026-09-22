<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import AppDialog from '../../../shell/app-src/components/AppDialog.vue';
import { COC7_CAPABILITIES, type Coc7Stat } from '../domain/coc7-catalog.js';
import { coc7StatValue, coc7RemainingPoints, coc7PointBudget, parseCoc7Sheet, readCoc7Sheet, COC7_POINT_GROUPS, type Coc7PointGroup, type Coc7Sheet } from '../domain/coc7-sheet.js';
import { emptyCoc7Draft, generateCoc7Sheet, adjustCoc7Stat, canAdjustCoc7Stat, type Coc7Draft } from '../domain/coc7-creation.js';
import { COC7_UI as copy } from './coc7-copy.js';

const props = defineProps<{ sheet: Coc7Sheet | null; invalid?: boolean; busy: boolean; failure?: string; blocked?: boolean;
    checkSave?: () => Promise<boolean>; save: (sheet: Coc7Sheet | null) => Promise<boolean> }>();
const emit = defineEmits<{ confirmed: [] }>();
const locked = computed(() => props.busy || props.blocked);
const draft = shallowRef<Coc7Draft | null>(null);
// Only a submitted, unconfirmed operation can consume the local draft on recovery.
const pendingSubmission = shallowRef<Coc7Sheet | null | undefined>();
const opened = ref(false);
const error = ref('');
const confirmingReset = ref(false);
const visible = computed(() => draft.value ?? props.sheet ?? emptyCoc7Draft());
const ready = computed(() => readCoc7Sheet(visible.value).kind === 'ready');
const groups = (Object.keys(COC7_POINT_GROUPS) as Coc7PointGroup[]).map(id => ({
    id, label: copy[id], ids: COC7_POINT_GROUPS[id].ids, budget: coc7PointBudget(id),
}));
watch([pendingSubmission, () => props.sheet, () => props.invalid, () => props.blocked, () => props.busy], () => {
    if (props.busy || props.blocked || pendingSubmission.value === undefined) { return; }
    const submitted = pendingSubmission.value;
    pendingSubmission.value = undefined;
    const saved = props.sheet;
    const matches = !props.invalid && (submitted === null ? saved === null : saved !== null
        && groups.every(group => group.ids.every(id => coc7StatValue(saved, id) === coc7StatValue(submitted, id))));
    if (matches) { cancel(); emit('confirmed'); }
});
function update(value: Coc7Draft) { pendingSubmission.value = undefined; draft.value = value; error.value = ''; confirmingReset.value = false; }
function closeSheet() {
    if (props.busy) { return; }
    opened.value = false; confirmingReset.value = false;
}
function adjust(stat: Coc7Stat, direction: -1 | 1) {
    if (!locked.value) { update(adjustCoc7Stat(visible.value, stat, direction)); }
}
function randomize() { if (!locked.value) { update(generateCoc7Sheet()); } }
async function saveDraft() {
    if (locked.value || (!draft.value && props.sheet)) { return; }
    if (!ready.value) { error.value = copy.invalidAllocation; return; }
    await submit(parseCoc7Sheet(visible.value));
}
function cancel() { pendingSubmission.value = undefined; draft.value = null; error.value = ''; confirmingReset.value = false; }
async function submit(sheet: Coc7Sheet | null) {
    if (await props.save(sheet)) { cancel(); }
    else {
        if (props.blocked) { pendingSubmission.value = sheet; }
        error.value = sheet === null ? copy.resetFailed : copy.saveFailed;
    }
}
async function reset() {
    if (locked.value) { return; }
    await submit(null);
}
</script>

<template>
    <button type="button" class="coc-entry" data-sheet-action="open" aria-haspopup="dialog" :aria-expanded="opened" :disabled="busy" @click="opened = true">
        <svg class="coc-entry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M3 3h3M18 3h3M3 3v4M21 3v4" /></svg>
        <span>{{ copy.title }}</span><small :class="{ 'needs-repair': invalid }">{{ draft ? copy.unsaved : invalid ? copy.repair : sheet ? copy.saved : copy.unassigned }}</small>
        <svg class="coc-entry-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
    </button>
    <p v-if="invalid" role="alert" class="coc-entry-warning" data-sheet-state="invalid">{{ copy.repairNotice }}</p>
    <AppDialog v-if="opened" class="coc-dialog" aria-labelledby="coc-sheet-title" :busy="busy" @close="closeSheet">
        <section class="coc-sheet" aria-labelledby="coc-sheet-title">
            <header class="coc-header">
                <div><h2 id="coc-sheet-title">{{ copy.title }}</h2><small>{{ copy.scope }}</small></div>
                <button type="button" class="coc-close" data-sheet-action="close" :aria-label="copy.close" :disabled="busy" autofocus @click="closeSheet"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
            </header>
            <div class="coc-budgets" aria-live="polite">
                <div v-for="group in groups" :key="group.id" :data-budget="group.id">
                    <span>{{ group.label }}<small>{{ copy.remaining }}</small></span>
                    <strong :class="{ complete: coc7RemainingPoints(visible, group.id) === 0 }">{{ coc7RemainingPoints(visible, group.id) }}</strong>
                    <small>{{ copy.allocated }} {{ group.budget - coc7RemainingPoints(visible, group.id) }} / {{ group.budget }}</small>
                </div>
            </div>
            <div class="coc-scroll">
                <p v-if="invalid" role="alert" class="coc-error">{{ copy.damaged }}</p>
                <p class="coc-limits">{{ copy.limits }}</p>
                <section v-for="group in groups" :key="group.id" class="coc-group" :aria-labelledby="'coc-' + group.id">
                    <h3 :id="'coc-' + group.id">{{ group.label }}</h3>
                    <div class="coc-grid">
                        <div v-for="id in group.ids" :key="id" class="coc-stat" :data-stat="id">
                            <div class="coc-stat-name"><span :id="'coc-label-' + id">{{ COC7_CAPABILITIES[id].label }}</span><small>{{ COC7_CAPABILITIES[id].description }}</small></div>
                            <div class="coc-stepper" role="group" :aria-labelledby="'coc-label-' + id">
                                <button type="button" data-step="decrease" :aria-label="copy.decrease + COC7_CAPABILITIES[id].label" :disabled="locked || !canAdjustCoc7Stat(visible, id, -1)" @click="adjust(id, -1)">−</button>
                                <output :aria-labelledby="'coc-label-' + id">{{ coc7StatValue(visible, id) }}</output>
                                <button type="button" data-step="increase" :aria-label="copy.increase + COC7_CAPABILITIES[id].label" :disabled="locked || !canAdjustCoc7Stat(visible, id, 1)" @click="adjust(id, 1)">+</button>
                            </div>
                        </div>
                    </div>
                </section>
                <button v-if="(sheet || invalid) && !confirmingReset" type="button" class="coc-reset" data-sheet-action="reset" :disabled="locked" @click="confirmingReset = true">{{ copy.reset }}</button>
            </div>
            <footer class="coc-footer">
                <p v-if="failure || error || blocked" role="alert" class="coc-error">{{ failure || (blocked ? copy.saveUnconfirmed : error) }}</p>
                <button v-if="blocked" type="button" data-sheet-action="check-save" :disabled="busy" @click="checkSave?.()">{{ copy.checkSave }}</button>
                <div v-if="confirmingReset && !blocked" class="coc-reset-confirm" role="group" aria-labelledby="coc-reset-question">
                    <p id="coc-reset-question">{{ copy.resetQuestion }}</p>
                    <p>{{ copy.resetNotice }}</p>
                    <div class="coc-draft-actions">
                        <button type="button" data-sheet-action="cancel-reset" :disabled="busy" @click="confirmingReset = false">{{ copy.cancelReset }}</button>
                        <button type="button" class="primary" data-sheet-action="confirm-reset" :disabled="locked" @click="reset">{{ busy ? copy.resetting : copy.confirmReset }}</button>
                    </div>
                </div>
                <div v-else-if="!blocked" class="coc-draft-actions">
                    <button type="button" class="coc-random" data-sheet-action="generate" :disabled="locked" @click="randomize">{{ copy.generate }}</button>
                    <span v-if="!draft && sheet" class="coc-saved" role="status">{{ copy.saved }}</span>
                    <button v-if="draft" type="button" data-sheet-action="cancel" :disabled="busy" @click="cancel">{{ copy.cancel }}</button>
                    <button type="button" class="primary" data-sheet-action="save" :disabled="locked || (!draft && !!sheet) || !ready" @click="saveDraft">{{ busy ? copy.saving : copy.save }}</button>
                </div>
            </footer>
        </section>
    </AppDialog>
</template>

<style scoped>
.coc-entry { display:flex; align-items:center; gap:12px; width:100%; margin-top:16px; padding:12px 14px; text-align:left; background:color-mix(in srgb,#8577f0 9%,transparent); }
.coc-entry > span { font-size:14px; font-weight:600; }
.coc-entry small { margin-left:auto; white-space:nowrap; }
.coc-entry-icon { width:24px; height:24px; color:#8577f0; flex-shrink:0; }
.coc-entry-arrow { width:16px; height:16px; opacity:.5; }
.coc-entry-warning { font-size:12px; margin:8px 0 0; }
.needs-repair { color:var(--xiaobai-os-ink); opacity:1; }
:global(.os-app-dialog-shade > .coc-dialog[role="dialog"]) { display:flex; flex-direction:column; width:660px; max-height:min(780px,100%); overflow:hidden; border-radius:18px; background:var(--xiaobai-os-screen); color:var(--xiaobai-os-ink); box-shadow:0 16px 64px rgb(0 0 0 / 20%); font-size:14px; line-height:1.5; }
.coc-sheet { container-type:inline-size; display:flex; flex:1; flex-direction:column; min-height:0; }
.coc-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px 8px; flex-shrink:0; }
.coc-header > div { display:flex; align-items:baseline; flex-wrap:wrap; gap:8px; }
.coc-close { width:44px; padding:10px; flex-shrink:0; }
.coc-close svg { display:block; width:24px; height:24px; }
.coc-budgets { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; flex-shrink:0; padding:4px 20px 14px; border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent); }
.coc-budgets > div { display:grid; grid-template-columns:1fr auto; align-items:baseline; gap:2px 8px; }
.coc-budgets span small { margin-left:6px; }
.coc-budgets > div > small { grid-column:1/-1; }
.coc-budgets strong { font-size:25px; font-weight:600; font-variant-numeric:tabular-nums; color:#8577f0; }
.coc-budgets strong.complete { color:inherit; }
.coc-scroll { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 20px 16px; scrollbar-width:thin; }
.coc-footer { flex-shrink:0; padding:12px 16px; border-top:1px solid color-mix(in srgb,currentColor 12%,transparent); }
.coc-footer .coc-error { margin:0 0 10px; }
h2 { margin:0; font-size:17px; font-weight:650; }
h3 { margin:10px 0 4px; font-size:12px; font-weight:600; opacity:.7; }
small { font-size:11px; opacity:.7; }
button { color:inherit; font:inherit; min-height:44px; border:0; border-radius:8px; padding:6px 10px; background:transparent; cursor:pointer; }
button:hover { background:color-mix(in srgb,currentColor 7%,transparent); }
button:disabled { opacity:.35; cursor:default; }
button:focus-visible { outline:2px solid #8577f0; outline-offset:2px; }
.coc-limits { font-size:11px; opacity:.7; margin:12px 0; }
.coc-group + .coc-group { margin-top:14px; }
.coc-grid { display:grid; grid-template-columns:minmax(0,1fr); }
.coc-stat { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid color-mix(in srgb,currentColor 7%,transparent); }
.coc-stat-name { min-width:0; }
.coc-stat-name > span { font-weight:550; }
.coc-stat-name small { display:block; margin-top:2px; overflow-wrap:anywhere; }
.coc-stepper { display:flex; align-items:center; flex-shrink:0; background:color-mix(in srgb,currentColor 4%,transparent); border-radius:9px; }
.coc-stepper button { width:44px; padding:0; font-size:20px; }
.coc-stepper output { width:32px; text-align:center; font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
.coc-random { flex-shrink:0; margin-right:auto; background:color-mix(in srgb,#8577f0 12%,transparent); }
.coc-draft-actions { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:6px; font-size:13px; }
.coc-saved { font-size:12px; opacity:.65; }
button.primary { background:#7062d9; color:white; min-width:64px; }
.coc-reset { font-size:12px; opacity:.7; margin-top:16px; }
.coc-reset-confirm { font-size:13px; }.coc-reset-confirm p { margin:8px 0; }
#coc-reset-question { font-weight:600; }
.coc-error { font-size:13px; color:var(--xiaobai-os-ink); border-left:3px solid #d47757; padding-left:10px; }
@container (min-width:590px) { .coc-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 24px; } }
@media (max-width:380px) {
    .coc-header { padding:12px 14px 6px; }
    .coc-budgets { padding:2px 14px 12px; }
    .coc-scroll { padding:0 14px 12px; }
    .coc-footer { padding:10px; }
}
</style>
