import type { ICartItemRecord, ICartItemRecordDTO, ICartResponse, ICartResponseDTO } from '@msdining/common/models/cart';
import { menuItemBaseToDTO } from '@msdining/common/util/menu-item-serde';

export const serializeCartItem = (item: ICartItemRecord): ICartItemRecordDTO => ({
    ...item,
    menuItem: {
        ...menuItemBaseToDTO(item.menuItem),
        totalReviewCount: 0,
        overallRating:    0,
        firstAppearance:  '',
    },
});

export const serializeCartResponse = (cart: ICartResponse): ICartResponseDTO => ({
    cafes: cart.cafes.map(group => ({
        cafeId:       group.cafeId,
        items:        group.items.map(serializeCartItem),
        availability: group.availability,
    })),
});
