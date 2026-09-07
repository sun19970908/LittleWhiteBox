import type { ShopCatalogItemView } from '../types.js';

export function shopPurchaseReason(item: ShopCatalogItemView, balance: number): string {
    if (!item.onShelf) {return '商品已下架，已拥有的奇物仍可使用';}
    if (item.purchaseLimit !== null && item.purchasedCount >= item.purchaseLimit) {return '已达购买上限';}
    if (balance < item.price) {return `还差 ${(item.price - balance).toLocaleString('zh-CN')} 小白币`;}
    return '';
}

export function shopUseNotice(item: ShopCatalogItemView): string {
    if (item.duration === 'permanent') {return '使用后永久生效，不能在 APP 中关闭。';}
    if (item.duration === 'manual') {return '使用后持续生效，可在「生效中」手动关闭。';}
    return `${item.durationLabel}，次数用完后自动结束。`;
}
