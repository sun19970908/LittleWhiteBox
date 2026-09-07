<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ShopCatalogItemView } from '../types.js';
import ShopIcon from './ShopIcon.vue';
import ShopItemArt from './ShopItemArt.vue';

const props = defineProps<{ catalog: ShopCatalogItemView[] }>();
defineEmits<{ open: [item: ShopCatalogItemView] }>();
const selectedCategory = ref('all');
const query = ref('');
const shelfItems = computed(() => props.catalog.filter(item => item.onShelf));
const categories = computed(() => {
    const found = new Map(shelfItems.value.map(item => [item.category, item.categoryLabel]));
    return [{ id: 'all', label: '全部' }, ...Array.from(found, ([id, label]) => ({ id, label }))];
});
const visibleItems = computed(() => {
    const text = query.value.trim().toLocaleLowerCase('zh-CN');
    return shelfItems.value.filter(item => (selectedCategory.value === 'all' || item.category === selectedCategory.value)
        && (!text || [item.name, item.description, item.categoryLabel].some(value => value.toLocaleLowerCase('zh-CN').includes(text))));
});
function reset(): void {
    query.value = '';
    selectedCategory.value = 'all';
}
</script>
<template>
    <section class="shop-shelf shop-page" aria-label="商品货架">
        <label class="shop-search"><ShopIcon name="search" /><input v-model="query" type="search" placeholder="搜索商品" aria-label="搜索商品" autocomplete="off"><button v-if="query" type="button" aria-label="清空搜索" @click="query = ''"><ShopIcon name="close" /></button></label>
        <nav class="shop-categories" aria-label="商品分类">
            <button v-for="category in categories" :key="category.id" type="button" :aria-pressed="selectedCategory === category.id" @click="selectedCategory = category.id">{{ category.label }}</button>
        </nav>
        <p v-if="query.trim()" class="shop-search-count" role="status">找到 {{ visibleItems.length }} 件商品</p>
        <div v-if="visibleItems.length" class="shop-product-grid">
            <button v-for="item in visibleItems" :key="item.id" type="button" class="shop-product-card" :data-item-id="item.id" :aria-label="`查看${item.name}`" @click="$emit('open', item)">
                <span class="shop-product-stage" :data-category="item.category">
                    <ShopItemArt :name="item.icon" />
                    <span v-if="item.quantity" class="shop-owned-tag">持有 {{ item.quantity }}</span>
                    <span v-else-if="item.purchaseLimit !== null && item.purchasedCount >= item.purchaseLimit" class="shop-owned-tag">已购满</span>
                </span>
                <span class="shop-product-info"><strong>{{ item.name }}</strong><span class="shop-product-duration">{{ item.durationLabel }}</span><span class="shop-product-price"><b><i>¤</i> {{ item.price.toLocaleString('zh-CN') }}</b></span></span>
            </button>
        </div>
        <div v-else class="shop-empty"><span><ShopIcon name="search" /></span><h3>{{ shelfItems.length ? '还没找到这件奇物' : '货架暂时没有商品' }}</h3><p>{{ shelfItems.length ? '试试其他名称、效果或分类。' : '已拥有的奇物仍然留在背包里。' }}</p><button v-if="shelfItems.length" type="button" class="shop-secondary-button" @click="reset">看看全部奇物</button></div>
    </section>
</template>
