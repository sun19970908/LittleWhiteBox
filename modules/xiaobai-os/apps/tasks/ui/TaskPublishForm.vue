<script setup lang="ts">
import { reactive } from 'vue';
import type { TaskPublishedForm } from '../types.js';
import TaskIcon from './TaskIcon.vue';
import { taskMoney } from './task-display.js';
defineProps<{ balance: number; busy: boolean; disabledReason: string }>();
const emit = defineEmits<{ submit: [form: TaskPublishedForm] }>();
const form = reactive({ title: '', objective: '', requirements: '', location: '', risk: '', reward: 20 });
function submit(): void {
    emit('submit', { title: form.title, objective: form.objective, ...(form.requirements.trim() ? { requirements: form.requirements } : {}), location: form.location, risk: form.risk, reward: Number(form.reward) });
}
</script>
<template>
    <section class="tasks-page tasks-publish-page">
        <form class="tasks-publish-form" @submit.prevent="submit">
            <fieldset :disabled="busy">
                <legend class="tasks-sr-only">委托内容</legend>
                <div class="tasks-form-group">
                    <label><span>委托名称 <b>*</b></span><input v-model="form.title" required maxlength="120" autocomplete="off" placeholder="例如：找回钟楼的手札"></label>
                    <label><span>完成目标 <b>*</b></span><textarea v-model="form.objective" required maxlength="8000" rows="3" placeholder="怎样才算完成？" /></label>
                    <label><span>行动地点 <b>*</b></span><input v-model="form.location" required maxlength="600" autocomplete="off" placeholder="例如：旧城钟楼"></label>
                </div>
                <details class="tasks-form-extra"><summary>补充约束与风险 <span>选填</span></summary><div class="tasks-form-group"><label><span>执行约束</span><textarea v-model="form.requirements" maxlength="8000" rows="3" placeholder="对行动方式的要求，不增加第二个目标" /></label><label><span>已知风险</span><textarea v-model="form.risk" maxlength="2000" rows="3" placeholder="有哪些需要执行者提前知道的风险？" /></label></div></details>
                <div class="tasks-reward-editor"><label><span>为这份委托设定报酬 <b>*</b></span><span class="tasks-amount-input"><i>¤</i><input v-model.number="form.reward" aria-label="托管报酬" type="number" required min="1" :max="balance" step="1"></span></label><div class="tasks-reward-presets"><button v-for="amount in [20, 50, 100]" :key="amount" type="button" :aria-pressed="Number(form.reward) === amount" :disabled="amount > balance" @click="form.reward = amount">¤ {{ amount }}</button></div><p>可用余额 <strong>¤ {{ taskMoney(balance) }}</strong></p><p v-if="Number(form.reward) > balance" class="tasks-error-text" role="status">报酬超出可用余额，请调整金额。</p></div>
            </fieldset>
            <p class="tasks-hint"><TaskIcon name="ticket" />发布时托管报酬；招募中或执行中均可取消，全额退还托管报酬。</p>
            <p v-if="disabledReason" class="tasks-hint">{{ disabledReason }}</p>
            <button type="submit" class="tasks-primary-button tasks-full-button" :disabled="busy || Boolean(disabledReason) || Number(form.reward) > balance">{{ busy ? '正在发布…' : '预览并发布' }}<TaskIcon name="next" /></button>
        </form>
    </section>
</template>
