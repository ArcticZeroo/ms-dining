import { IMenuItemBase } from '@msdining/common/models/cafe';
import { ICartItemWithMetadata, ISerializedCartItem, ISerializedCartItemWithName } from '../../src/models/cart.ts';

export const makeMenuItem = (overrides: Partial<IMenuItemBase> = {}): IMenuItemBase => ({
    id:           'menu-item-1',
    cafeId:       'cafe-1',
    stationId:    'station-1',
    price:        5.00,
    name:         'Test Item',
    calories:     0,
    maxCalories:  0,
    hasThumbnail: false,
    modifiers:    [],
    tags:         new Set(),
    searchTags:   new Set(),
    ...overrides,
});

export const makeCartItem = (overrides: Partial<ICartItemWithMetadata> = {}): ICartItemWithMetadata => {
    const associatedItem = overrides.associatedItem ?? makeMenuItem();
    return {
        id:                  'cart-item-1',
        cafeId:              associatedItem.cafeId,
        itemId:              associatedItem.id,
        quantity:            1,
        price:               associatedItem.price,
        specialInstructions: '',
        choicesByModifierId: new Map(),
        associatedItem,
        ...overrides,
    };
};

export const makeSerializedItem = (overrides: Partial<ISerializedCartItemWithName> = {}): ISerializedCartItemWithName => ({
    itemId:              'menu-item-1',
    name:                'Test Item',
    quantity:            1,
    modifiers:           [],
    specialInstructions: '',
    ...overrides,
});

export const makeSerializedModifier = (modifierId: string, choiceIds: string[]): ISerializedCartItem['modifiers'][number] => ({
    modifierId,
    choiceIds,
});
