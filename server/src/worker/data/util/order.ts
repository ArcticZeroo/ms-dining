import type { IOrderItem } from '@msdining/common/models/order';
import { createHash } from 'node:crypto';
import { groupModifierRows } from '@msdining/common/util/modifier-util';
import { ISerializedModifier } from '@msdining/common/models/shared';
import { asRecord } from '../../../shared/util/typeguard.js';
import { ICartItemRecord } from '@msdining/common/models/cart';
import { ORDER_TIMEZONE } from '../../models/ordering.js';

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
export const hashOrderItems = (items: Array<IOrderItem> | Array<ICartItemRecord>): string => {
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
/**
 * Formats `date` as a local ISO-8601 string with offset (e.g.
 * `"2026-04-23T11:51:56.923-07:00"`), matching the wire format the BoD UI
 * sends for billDate / userCurrentDate. `Date.toISOString()` would emit UTC
 * `Z` form, which the server appears to accept but differs from what the
 * official client sends — keeping the shape identical is cheap insurance.
 */
export const toLocalIsoOffset = (date: Date, timeZone: string = ORDER_TIMEZONE): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year:         'numeric', month: '2-digit', day: '2-digit',
        hour:         '2-digit', minute: '2-digit', second: '2-digit',
        hour12:       false, fractionalSecondDigits: 3,
        timeZoneName: 'longOffset',
    }).formatToParts(date);

    const find = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(part => part.type === type)?.value ?? '';

    // Intl's longOffset is `GMT-07:00` (or `GMT` for UTC). Strip the `GMT`
    // prefix; treat bare `GMT` as `+00:00`.
    const tzPart = find('timeZoneName');
    const offset = tzPart === 'GMT' ? '+00:00' : tzPart.slice(3);
    // Intl renders midnight as hour=24; normalize back to 00.
    const hour = find('hour') === '24' ? '00' : find('hour');

    return `${find('year')}-${find('month')}-${find('day')}T${hour}:${find('minute')}:${find('second')}.${find('fractionalSecond')}${offset}`;
};

export const formatReceiptDateTime = (date: Date) => {
    const receiptDate = new Intl.DateTimeFormat('en-US', {
        timeZone: ORDER_TIMEZONE,
        month:    'short',
        day:      'numeric',
        year:     'numeric',
    }).format(date);
    const receiptTime = new Intl.DateTimeFormat('en-US', {
        timeZone: ORDER_TIMEZONE,
        hour:     'numeric',
        minute:   '2-digit',
        hour12:   true,
    }).format(date);
    const dateTimeInReceipt = toLocalIsoOffset(date).replace(/\.\d{3}(?=[+-]\d{2}:\d{2}$)/, '');
    const offsetMatch = dateTimeInReceipt.match(/([+-])(\d{2}):(\d{2})$/);
    const timezoneOffsetMinutes = offsetMatch == null
        ? 0
        : (offsetMatch[1] === '-' ? 1 : -1) * ((Number(offsetMatch[2]) * 60) + Number(offsetMatch[3]));

    return {
        receiptDate,
        receiptTime,
        dateTimeInReceipt,
        timezoneOffsetMinutes,
        printDateTime: `${receiptDate} ${receiptTime} `,
    };
};