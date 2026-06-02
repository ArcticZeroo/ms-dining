/**
 * Synthesize BuyOnDemand cart items from our DB for the getWaitTimeForItems API.
 *
 * This mirrors the item-building logic in CafeOrderSession._addItemToCart() +
 * _synthesizeItemDetail() but produces only the `item` objects needed for the
 * wait time endpoint — no ordering context, schedule, or currency fields.
 */
import type { BuyOnDemandClient } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import type { IOrderItem } from '@msdining/common/models/order';
import { getServices } from '../../../../shared/services/registry.js';

/**
 * Synthesize a BoD-shaped cart item from DB data for the wait time API.
 * Returns the `item` object (same shape as requestBody.item in _addItemToCart).
 */
const synthesizeCartItemForWaitTime = async (
    orderItem: IOrderItem,
    config: { contextId: string; tenantId: string },
) => {
    const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: orderItem.menuItemId });
    if (menuItem == null) {
        return null;
    }

    const station = await getServices().data.station.retrieveStation({ stationId: menuItem.stationId });
    if (station == null) {
        return null;
    }

    const amount = menuItem.price.toFixed(2);
    const receiptText = menuItem.receiptText ?? menuItem.name;

    return {
        id:                    menuItem.id,
        contextId:             config.contextId,
        tenantId:              config.tenantId,
        itemId:                menuItem.id,
        name:                  menuItem.name,
        displayText:           menuItem.name,
        amount,
        price:                 { currencyUnit: 'USD', amount },
        menuId:                station.menuId,
        receiptText,
        kpText:                receiptText,
        kitchenDisplayText:    receiptText,
        properties:            {},
        isDeleted:             false,
        isActive:              false,
        isSoldByWeight:        false,
        tareWeight:            0,
        isDiscountable:        true,
        allowPriceOverride:    true,
        isTaxIncluded:         false,
        taxClasses:            [],
        kitchenVideoCategoryId:  0,
        kitchenCookTimeSeconds:  0,
        skus:                  [],
        itemType:              'ITEM',
        itemImages:            [],
        isAvailableToGuests:   true,
        isPreselectedToGuests: false,
        tagNames:              [],
        tagIds:                [],
        substituteItemId:      '',
        isSubstituteItem:      false,
        sequence:              0,
        description:           menuItem.description ?? '',
        longDescription:       menuItem.description ?? '',
        options:               [],
        attributes:            [],
        choiceGroupsUnavailable: false,
        // Cart-specific fields needed by the wait time API
        count:                 orderItem.quantity,
        quantity:              orderItem.quantity,
        conceptId:             station.id,
        conceptName:           station.name,
        holdAndFire:           false,
        mealPeriodId:          null,
        uniqueId:              `${menuItem.id}-waittime`,
        cartItemId:            `waittime-${menuItem.id}`,
    };
};

/**
 * Synthesize an array of BoD cart items from IOrderItem[] for the wait time API.
 * Skips items whose menu item or station can't be found in DB.
 */
export const synthesizeCartItemsForWaitTime = async (
    client: BuyOnDemandClient,
    orderItems: IOrderItem[],
): Promise<unknown[]> => {
    const config = client.config;
    if (!config) {
        throw new Error('Client config is not set');
    }

    const cartItems: unknown[] = [];
    for (const orderItem of orderItems) {
        const item = await synthesizeCartItemForWaitTime(orderItem, config);
        if (item != null) {
            cartItems.push(item);
        }
    }

    return cartItems;
};
