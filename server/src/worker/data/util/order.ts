import type { IOrderItem } from '@msdining/common/models/order';
import { createHash } from 'node:crypto';
import { groupModifierRows } from '@msdining/common/util/modifier-util';

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
			modifiers:           item.modifiers
									 .map(mod => `${mod.modifierId}:${[...mod.choiceIds].sort().join(',')}`)
									 .sort(),
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