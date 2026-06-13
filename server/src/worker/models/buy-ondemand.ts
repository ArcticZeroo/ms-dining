import z from 'zod';
import { NonEmptyArray } from '../../shared/models/util.js';
import { IConceptScheduleTaskItem } from '../util/schedule.js';

const BuyOnDemandOrderDetailsSchema = z.object({
    orderId:                z.string(),
    orderNumber:            z.string(),
    created:                z.string().optional(),
    taxExcludedTotalAmount: z.object({ amount: z.string() }),
    taxTotalAmount:         z.object({ amount: z.string() }),
    totalDueAmount:         z.object({ amount: z.string() }),
    lineItems:              z.array(z.object({ lineItemId: z.string() }).passthrough()),
    properties:             z.record(z.unknown()).optional(),
}).passthrough();

export const BuyOnDemandAddToOrderResponseSchema = z.object({
    orderDetails: BuyOnDemandOrderDetailsSchema,
});

export type IBuyOnDemandOrderDetails = z.infer<typeof BuyOnDemandOrderDetailsSchema>;

export interface IBuyOnDemandModifier {
    // ID of selected option
    id: string;
    // ID of the modifier
    parentGroupId: string;
    description: string;
    selected: true;
    baseAmount: string;
    amount: string;
    childPriceLevelId: string;
    currencyUnit: 'USD';
    tagNames: [];
    tagIds: [];
    isModifierAvailableToGuests: true;
    // TODO: Support multiple of one thing
    //   I don't know of any menu items that support this, though
    quantity: 1;
    count: 1;
    properties: {
        applicableTargetMenuFilter: 'All'
    };
}

interface BuyOnDemandLineItemInstructionItem {
    label: '';
    text: string;
}

export type BuyOnDemandSpecialInstructionsOrEmpty = [] | [BuyOnDemandLineItemInstructionItem];
export type BuyOnDemandAtLeastOneModifier = NonEmptyArray<IBuyOnDemandModifier>;

export interface IBuyOnDemandCartItem {
    id: string,
    contextId: string,
    tenantId: string,
    itemId: string,
    name: string,
    displayText: string,
    amount: string,
    price: {
        currencyUnit: string,
        amount: string,
    },
    menuId: string,
    menuPriceLevelId: string,
    menuPriceLevelApplied: boolean,
    receiptText: string,
    kpText: string,
    kitchenDisplayText: string,
    count: number,
    quantity: number,
    conceptId: string,
    conceptName: string,
    holdAndFire: false,
    hasModifiers: boolean,
    modifierTotal: number,
    mealPeriodId: null,
    uniqueId: string,
    cartItemId: string,
    selectedModifiers?: BuyOnDemandAtLeastOneModifier,
    properties: {
        cartGuid: string,
        scannedItem: false,
        priceLevelId: string,
    },
    isDeleted: false,
    isActive: false,
    isSoldByWeight: false,
    tareWeight: 0,
    isDiscountable: true,
    allowPriceOverride: true,
    isTaxIncluded: false,
    taxClasses: [],
    kitchenVideoCategoryId: 0,
    kitchenCookTimeSeconds: 0,
    skus: [],
    itemType: 'ITEM',
    itemImages: [],
    isAvailableToGuests: true,
    isPreselectedToGuests: false,
    tagNames: [],
    tagIds: [],
    substituteItemId: string,
    isSubstituteItem: false,
    sequence: 0,
    description: string,
    longDescription: string,
    options: [],
    attributes: [],
    choiceGroupsUnavailable: false,
    lineItemInstructions: BuyOnDemandSpecialInstructionsOrEmpty,
}

export interface IBuyOnDemandAddToCartRequest {
    item: IBuyOnDemandCartItem,
    currencyDetails: {
        currencyDecimalDigits: '2',
        currencyCultureName: 'en-US',
        currencyCode: 'USD',
        currencySymbol: '$',
    },
    orderTimeZone: string,
    storePriceLevel: string,
    scheduledDay: 0,
    useIgOrderApi: true,
    onDemandTerminalId: string,
    schedule: Array<IConceptScheduleTaskItem>,
    properties: {
        checkTypeId?: string,
        employeeId: string,
        profitCenterId: string,
        orderSourceSystem: 'onDemand',
        orderNumberSequenceLength: 4,
        orderNumberNameSpace: string,
        displayProfileId: string,
        voidReasonId: '11',
        priceLevelId: string,
    },
    conceptSchedule: {
        openScheduleExpression: string,
        closeScheduleExpression: string,
    },
    isMultiItem: false,
    scannedOrder: false,
}

export interface IBuyOnDemandReceiptItem extends IBuyOnDemandCartItem {
    languageCode: 'en',
    lineItemId?: string
}