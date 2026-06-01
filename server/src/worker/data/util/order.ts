import type { IOrderItem } from '@msdining/common/models/order';
import { createHash } from 'node:crypto';
import { groupModifierRows } from '@msdining/common/util/modifier-util';
import { ISerializedModifier } from '@msdining/common/models/shared';
import { asRecord } from '../../../shared/util/typeguard.js';

const getModifierStringsForHash = (modifiers: ISerializedModifier[]) => {
    const modifierStrings: string[] = [];
    for (const modifier of modifiers) {
        const choiceIds = [...modifier.choiceIds].sort().join(',');
        modifierStrings.push(`${modifier.modifierId}:${choiceIds}`);
    }
    return modifierStrings.sort();
}

/**
 * Deterministic hash of order items for deduplication.
 * Sorts by menuItemId, then by modifiers, to ensure identical item sets
 * produce the same hash regardless of array order.
 */
export const hashOrderItems = (items: IOrderItem[]): string => {
    const normalized = items
        .map(item => ({
            menuItemId:          item.menuItemId,
            quantity:            item.quantity,
            specialInstructions: item.specialInstructions ?? '',
            modifiers:           getModifierStringsForHash(item.modifiers),
        }))
        .sort((left, right) => left.menuItemId.localeCompare(right.menuItemId));

    return createHash('sha256')
        .update(JSON.stringify(normalized))
        .digest('hex');
};

interface IOrderItemFromDatabase {
	menuItemId: string;
	quantity: number;
	specialInstructions: string | null;
	modifiers: Array<{ modifierId: string; choiceId: string }>;
}

export const toOrderItem = (item: IOrderItemFromDatabase): IOrderItem => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions ?? undefined,
    modifiers:           groupModifierRows(item.modifiers),
});

export const toOrderItems = (items: Array<IOrderItemFromDatabase>): IOrderItem[] => items.map(toOrderItem);

const DEFAULT_BIR_CONFIG = {
    displayText:                         'OR#',
    acknowledgementReceiptDisplayText:  'AR#',
    acknowledgementReceiptIndicator:    'Acknowledgement Receipt#',
    officialReceiptIndicator:           'Official Receipt#',
};
const DEFAULT_CALORIE_CONFIG = {
    abbreviation: 'Cal',
    fullName:     'Calories',
};
const DEFAULT_STORE_ADDRESS = [' ', '  '];

export const buildStoreInfo = (storeInfo: Record<string, unknown>): Record<string, unknown> => {
    const storeInfoOptions = asRecord(storeInfo.storeInfoOptions) ?? {};

    return {
        ...storeInfo,
        storeInfoOptions: {
            ...storeInfoOptions,
            birConfig: storeInfoOptions.birConfig ?? DEFAULT_BIR_CONFIG,
            calories:  storeInfoOptions.calories ?? DEFAULT_CALORIE_CONFIG,
        },
        address: storeInfo.address ?? DEFAULT_STORE_ADDRESS,
    };
};
