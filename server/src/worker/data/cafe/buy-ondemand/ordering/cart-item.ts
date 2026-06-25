import { IMenuItemBase } from '@msdining/common/models/cafe';
import {
    BuyOnDemandAtLeastOneModifier,
    BuyOnDemandSpecialInstructionsOrEmpty, IBuyOnDemandCartItem,
    IBuyOnDemandModifier,
    IBuyOnDemandReceiptItem
} from '../../../../models/buy-ondemand.js';
import { isNonEmptyArray } from '../../../../../shared/util/typeguard.js';
import { Nullable } from '@msdining/common/models/util';
import hat from 'hat';
import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { IEnhancedOrderItem } from '../../../../models/ordering.js';
import { ICafeConfig } from '../../../../../shared/models/cafe.js';
import { toChoicesByModifierId } from '../../../util/order.js';

const convertModifierChoicesToBuyOnDemand = (orderingContext: IOrderingContext, choicesByModifierId: Map<string, Set<string>>, localMenuItem: IMenuItemBase): Array<IBuyOnDemandModifier> => {
    const modifiersById = new Map(localMenuItem.modifiers.map(modifier => [modifier.id, modifier]));

    const modifiers: IBuyOnDemandModifier[] = [];

    for (const [modifierId, choiceIds] of choicesByModifierId) {
        const modifier = modifiersById.get(modifierId);

        if (modifier == null) {
            throw new Error(`Failed to find modifier with id "${modifierId}"`);
        }

        for (const choiceId of choiceIds) {
            const choice = modifier.choices.find(choice => choice.id === choiceId);

            if (choice == null) {
                throw new Error(`Failed to find choice with id "${choiceId}" for modifier "${modifierId}"`);
            }

            const price = choice.price.toFixed(2);

            modifiers.push({
                id:                          choiceId,
                parentGroupId:               modifierId,
                description:                 choice.description,
                selected:                    true,
                baseAmount:                  price,
                amount:                      price,
                childPriceLevelId:           orderingContext.storePriceLevel,
                currencyUnit:                'USD',
                tagNames:                    [],
                tagIds:                      [],
                isModifierAvailableToGuests: true,
                quantity:                    1,
                count:                       1,
                properties:                  {
                    applicableTargetMenuFilter: 'All'
                }
            });
        }
    }

    return modifiers;
}


const getModifiersForCartItem = (modifiers: IBuyOnDemandModifier[]): BuyOnDemandAtLeastOneModifier | undefined => {
    if (isNonEmptyArray(modifiers)) {
        return modifiers;
    }

    return undefined;
}

const getSpecialInstructionsForCartItem = (specialInstructions: Nullable<string>): BuyOnDemandSpecialInstructionsOrEmpty => {
    if (!specialInstructions) {
        return [];
    }

    return [{
        label: '',
        text:  specialInstructions
    }];
}

interface IBuildItemForCartAddParams {
    orderItem: IEnhancedOrderItem;
    orderingContext: IOrderingContext;
    cafeConfig: ICafeConfig;
    // Shared across every item in the cart (shape: {firstItemId}-{sessionStartMs}).
    cartGuid: string;
    // Distinct per line (shape: {itemId}-{ts}); must differ from cartGuid.
    uniqueId: string;
}

export const buildItemForCartAdd = ({ orderItem, orderingContext, cafeConfig, cartGuid, uniqueId }: IBuildItemForCartAddParams): IBuyOnDemandCartItem => {
    const { quantity, menuItem, station, modifiers: orderItemModifiers, specialInstructions } = orderItem;
    const amount = menuItem.price.toFixed(2);
    const receiptText = menuItem.receiptText ?? menuItem.name;

    const choicesByModifierId = toChoicesByModifierId(orderItemModifiers);
    const modifiers = convertModifierChoicesToBuyOnDemand(orderingContext, choicesByModifierId, menuItem);
    const modifierTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.amount), 0);

    const cartItemId = hat();

    return {
        id:                    menuItem.id,
        contextId:             cafeConfig.contextId,
        tenantId:              cafeConfig.tenantId,
        itemId:                menuItem.id,
        name:                  menuItem.name,
        displayText:           menuItem.name,
        count:                 quantity,
        quantity:              quantity,
        amount,
        price:                 { currencyUnit: 'USD', amount },
        menuId:                station.menuId,
        conceptId:             station.id,
        conceptName:           station.name,
        holdAndFire:           false,
        hasModifiers:          modifiers.length > 0,
        modifierTotal,
        mealPeriodId:          null,
        uniqueId,
        cartItemId,
        menuPriceLevelId:      orderingContext.storePriceLevel,
        menuPriceLevelApplied: false,
        receiptText,
        kpText:                receiptText,
        kitchenDisplayText:    receiptText,
        // Constants from observed HAR responses
        isDeleted:               false,
        isActive:                false,
        isSoldByWeight:          false,
        tareWeight:              0,
        isDiscountable:          true,
        allowPriceOverride:      true,
        isTaxIncluded:           false,
        taxClasses:              [],
        kitchenVideoCategoryId:  0,
        kitchenCookTimeSeconds:  0,
        skus:                    [],
        itemType:                'ITEM',
        itemImages:              [],
        isAvailableToGuests:     true,
        isPreselectedToGuests:   false,
        tagNames:                [],
        tagIds:                  [],
        substituteItemId:        '',
        isSubstituteItem:        false,
        sequence:                0,
        description:             menuItem.description ?? '',
        longDescription:         menuItem.description ?? '',
        options:                 [],
        attributes:              [],
        choiceGroupsUnavailable: false,
        selectedModifiers:       getModifiersForCartItem(modifiers),
        lineItemInstructions:    getSpecialInstructionsForCartItem(specialInstructions),
        properties:              {
            cartGuid,
            scannedItem:  false,
            priceLevelId: orderingContext.storePriceLevel
        }
    };
}

/**
 * Builds the receipt items sent to the close-order endpoint by pairing each
 * built cart item with the server-assigned lineItemId from the order details.
 * The order-details lineItems carry no uniqueId/cartItemId, so the pairing is
 * positional — the BoD response returns lineItems in the order they were added.
 */
export const buildReceiptItems = (
    cartItems: ReadonlyArray<IBuyOnDemandCartItem>,
    lineItems: ReadonlyArray<{ lineItemId: string }>
): Array<IBuyOnDemandReceiptItem> => cartItems.map((cartItem, index) => ({
    ...cartItem,
    languageCode: 'en' as const,
    lineItemId:   lineItems[index]?.lineItemId,
}));
