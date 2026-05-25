import type { IOrderItem } from '@msdining/common/models/order';
import { createHash } from 'node:crypto';
import { ISerializedModifier } from '@msdining/common/models/cart';

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

const normalizeSerializedModifiers = (modifiers: ISerializedModifier[]) => modifiers
	.flatMap(modifier => modifier.choiceIds.map(choiceId => `${modifier.modifierId}:${choiceId}`))
	.sort();

const normalizeChoiceRows = (choices: Array<{ modifierId: string; choiceId: string }>) => choices
	.map(choice => `${choice.modifierId}:${choice.choiceId}`)
	.sort();

export const modifiersMatch = (
	left: ISerializedModifier[],
	right: Array<{ modifierId: string; choiceId: string }>,
): boolean => {
	const leftNormalized = normalizeSerializedModifiers(left);
	const rightNormalized = normalizeChoiceRows(right);
	return leftNormalized.length === rightNormalized.length
		&& leftNormalized.every((value, index) => value === rightNormalized[index]);
};

const groupModifierChoices = (choices: Array<{ modifierId: string; choiceId: string }>): ISerializedModifier[] => {
	const byModifier = new Map<string, string[]>();
	for (const { modifierId, choiceId } of choices) {
		const existing = byModifier.get(modifierId);
		if (existing) {
			existing.push(choiceId);
		} else {
			byModifier.set(modifierId, [choiceId]);
		}
	}

	return Array.from(byModifier, ([modifierId, choiceIds]) => ({
		modifierId,
		choiceIds: choiceIds.sort(),
	})).sort((a, b) => a.modifierId.localeCompare(b.modifierId));
};

export const toOrderItem = (item: {
	menuItemId: string;
	quantity: number;
	specialInstructions: string | null;
	modifiers: Array<{ modifierId: string; choiceId: string }>;
}): IOrderItem => ({
	menuItemId:          item.menuItemId,
	quantity:            item.quantity,
	specialInstructions: item.specialInstructions ?? undefined,
	modifiers:           groupModifierChoices(item.modifiers),
});

export const toOrderItems = (items: Array<{
	menuItemId: string;
	quantity: number;
	specialInstructions: string | null;
	modifiers: Array<{ modifierId: string; choiceId: string }>;
}>): IOrderItem[] => items.map(toOrderItem);