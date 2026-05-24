import { createHash } from 'node:crypto';
import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { MenuItemStorageClient } from './menu-item.js';
import type { ISerializedModifier } from '@msdining/common/models/cart';
import type { ICafeOrderDTO, IOrderItem } from '@msdining/common/models/order';
import { menuItemBaseToDTO } from '@msdining/common/util/menu-item-serde';

const ORDER_ITEMS_INCLUDE = {
	items: {
		include: {
			modifiers: {
				select: { modifierId: true, choiceId: true },
			},
		},
	},
} as const;

const normalizeSerializedModifiers = (modifiers: ISerializedModifier[]) => modifiers
	.flatMap(modifier => modifier.choiceIds.map(choiceId => `${modifier.modifierId}:${choiceId}`))
	.sort();

const normalizeChoiceRows = (choices: Array<{ modifierId: string; choiceId: string }>) => choices
	.map(choice => `${choice.modifierId}:${choice.choiceId}`)
	.sort();

const modifiersMatch = (
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

const toOrderItem = (item: {
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

/**
 * Deterministic hash of order items for deduplication.
 * Sorts by menuItemId, then by modifiers, to ensure identical item sets
 * produce the same hash regardless of array order.
 */
const hashOrderItems = (items: IOrderItem[]): string => {
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
		.digest('hex')
		.slice(0, 16);
};

export abstract class OrderStorageClient {
	/**
	 * Creates a PendingCafeOrder with item snapshots, or returns an existing
	 * one if there's already a pending order for this user+cafe with the same items.
	 */
	static async createPendingOrder(
		userId: string,
		cafeId: string,
		items: IOrderItem[],
	): Promise<{ id: string; isExisting: boolean }> {
		if (items.length === 0) {
			throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Order must contain at least one item');
		}

		const itemsHash = hashOrderItems(items);

		// Check for existing pending order with matching items
		const existing = await usePrismaClient(prisma => prisma.pendingCafeOrder.findFirst({
			where:  { userId, cafeId, itemsHash },
			select: { id: true },
		}));

		if (existing) {
			return { id: existing.id, isExisting: true };
		}

		const created = await usePrismaWrite(prisma => prisma.pendingCafeOrder.create({
			data:   {
				userId,
				cafeId,
				itemsHash,
				items: {
					create: items.map(item => ({
						menuItemId:          item.menuItemId,
						quantity:            item.quantity,
						specialInstructions: item.specialInstructions ?? null,
						modifiers:           {
							create: item.modifiers.flatMap(modifier =>
								modifier.choiceIds.map(choiceId => ({
									modifierId: modifier.modifierId,
									choiceId,
								})),
							),
						},
					})),
				},
			},
			select: { id: true },
		}));

		return { id: created.id, isExisting: false };
	}

	static async getPendingOrder(pendingOrderId: string) {
		const pendingOrder = await usePrismaClient(prisma => prisma.pendingCafeOrder.findUnique({
			where:   { id: pendingOrderId },
			include: ORDER_ITEMS_INCLUDE,
		}));

		if (!pendingOrder) {
			throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Pending order not found');
		}

		return pendingOrder;
	}

	static async deletePendingOrder(pendingOrderId: string): Promise<void> {
		await usePrismaWrite(prisma => prisma.pendingCafeOrder.deleteMany({
			where: { id: pendingOrderId },
		}));
	}

	static async createCompletedOrder(
		pendingOrderId: string,
		financials: {
			buyOnDemandOrderId: string;
			buyOnDemandOrderNumber: string;
			subtotal: number;
			tax: number;
			total: number;
			waitTimeMin: number;
			waitTimeMax: number;
			completedAt: Date;
		},
	): Promise<void> {
		await usePrismaTransaction(async tx => {
			const pendingOrder = await tx.pendingCafeOrder.findUnique({
				where:   { id: pendingOrderId },
				include: ORDER_ITEMS_INCLUDE,
			});

			if (!pendingOrder) {
				throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Pending order not found');
			}

			const menuItemIds = [...new Set(pendingOrder.items.map(item => item.menuItemId))];
			const menuItems = await tx.menuItem.findMany({
				where:  { id: { in: menuItemIds } },
				select: { id: true, name: true, price: true },
			});
			const menuItemsById = new Map(menuItems.map(item => [item.id, item]));

			await tx.cafeOrder.create({
				data: {
					userId:                 pendingOrder.userId,
					cafeId:                 pendingOrder.cafeId,
					buyOnDemandOrderId:     financials.buyOnDemandOrderId,
					buyOnDemandOrderNumber: financials.buyOnDemandOrderNumber,
					subtotal:               financials.subtotal,
					tax:                    financials.tax,
					total:                  financials.total,
					waitTimeMin:            financials.waitTimeMin,
					waitTimeMax:            financials.waitTimeMax,
					completedAt:            financials.completedAt,
					items:                  {
						create: pendingOrder.items.map(item => {
							const menuItem = menuItemsById.get(item.menuItemId);
							if (!menuItem) {
								throw new ServiceError(
									SERVICE_ERROR_CODES.NOT_FOUND,
									`Menu item ${item.menuItemId} not found`,
								);
							}

							return {
								menuItemId:          item.menuItemId,
								name:                menuItem.name,
								quantity:            item.quantity,
								price:               menuItem.price,
								specialInstructions: item.specialInstructions ?? null,
								modifiers:           {
									create: item.modifiers.map(modifier => ({
										modifierId: modifier.modifierId,
										choiceId:   modifier.choiceId,
									})),
								},
							};
						}),
					},
				},
			});

			await tx.pendingCafeOrder.delete({ where: { id: pendingOrderId } });
		});
	}

	static async deductFromCart(userId: string, items: IOrderItem[]): Promise<void> {
		await usePrismaTransaction(async tx => {
			const cartItems = await tx.cartItem.findMany({
				where:   {
					cartUserId: userId,
					menuItemId: { in: [...new Set(items.map(item => item.menuItemId))] },
				},
				include: {
					modifierChoices: {
						select: { modifierId: true, choiceId: true },
					},
				},
				orderBy: { createdAt: 'asc' },
			});

			for (const item of items) {
				const matchIndex = cartItems.findIndex(cartItem =>
					cartItem.menuItemId === item.menuItemId
					&& (cartItem.specialInstructions ?? null) === (item.specialInstructions ?? null)
					&& modifiersMatch(item.modifiers, cartItem.modifierChoices),
				);

				if (matchIndex === -1) {
					continue;
				}

				const cartItem = cartItems[matchIndex]!;
				if (cartItem.quantity > item.quantity) {
					cartItem.quantity -= item.quantity;
					await tx.cartItem.update({
						where: { id: cartItem.id },
						data:  { quantity: cartItem.quantity },
					});
					continue;
				}

				cartItems.splice(matchIndex, 1);
				await tx.cartItem.delete({ where: { id: cartItem.id } });
			}
		});
	}

	static async getCompletedOrdersToday(userId: string): Promise<ICafeOrderDTO[]> {
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(startOfDay);
		endOfDay.setDate(endOfDay.getDate() + 1);

		const orders = await usePrismaClient(prisma => prisma.cafeOrder.findMany({
			where:   {
				userId,
				completedAt: {
					gte: startOfDay,
					lt:  endOfDay,
				},
			},
			include: ORDER_ITEMS_INCLUDE,
			orderBy: { completedAt: 'desc' },
		}));

		// Collect all unique menu item IDs across all orders for enrichment
		const allMenuItemIds = [...new Set(orders.flatMap(order => order.items.map(item => item.menuItemId)))];
		const menuItemResults = await Promise.all(
			allMenuItemIds.map(id => MenuItemStorageClient.retrieveMenuItemAsync(id)),
		);
		const menuItemsById = new Map(
			allMenuItemIds.map((id, i) => [id, menuItemResults[i]] as const).filter(([, v]) => v != null),
		);

		return orders.map(order => ({
			id:                     order.id,
			cafeId:                 order.cafeId,
			buyOnDemandOrderId:     order.buyOnDemandOrderId,
			buyOnDemandOrderNumber: order.buyOnDemandOrderNumber,
			subtotal:               order.subtotal,
			tax:                    order.tax,
			total:                  order.total,
			waitTimeMin:            order.waitTimeMin,
			waitTimeMax:            order.waitTimeMax,
			completedAt:            order.completedAt.toISOString(),
			items:                  order.items.flatMap(item => {
				const menuItem = menuItemsById.get(item.menuItemId);
				if (!menuItem) {
					return [];
				}

				const modifierMap = new Map<string, string[]>();
				for (const mod of item.modifiers) {
					const existing = modifierMap.get(mod.modifierId);
					if (existing) {
						existing.push(mod.choiceId);
					} else {
						modifierMap.set(mod.modifierId, [mod.choiceId]);
					}
				}

				return [{
					menuItemId:          item.menuItemId,
					quantity:            item.quantity,
					price:               item.price,
					specialInstructions: item.specialInstructions,
					modifiers:           Array.from(modifierMap.entries()).map(([modifierId, choiceIds]) => ({
						modifierId,
						choiceIds,
					})),
					menuItem:            {
						...menuItemBaseToDTO(menuItem),
						totalReviewCount: 0,
						overallRating:    0,
						firstAppearance:  '',
					},
				}];
			}),
		}));
	}
}
