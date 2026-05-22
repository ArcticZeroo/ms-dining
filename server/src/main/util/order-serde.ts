import type { IActiveOrderSummary, IActiveOrderSummaryDTO, ICartItemRecord, ICartItemRecordDTO } from '@msdining/common/models/cart';
import { menuItemBaseToDTO } from '@msdining/common/util/menu-item-serde';

/** Convert a domain cart item record to wire-safe shape for JSON serialization. */
export const serializeCartItem = (item: ICartItemRecord): ICartItemRecordDTO => ({
    ...item,
    menuItem: {
        ...menuItemBaseToDTO(item.menuItem),
        totalReviewCount: 0,
        overallRating:    0,
        firstAppearance:  '',
    },
});

/** Convert a domain IActiveOrderSummary to wire-safe shape. */
export const serializeActiveOrder = (order: IActiveOrderSummary): IActiveOrderSummaryDTO => ({
    ...order,
    cafeParts: order.cafeParts.map(part => ({
        ...part,
        items: part.items.map(serializeCartItem),
    })),
});
