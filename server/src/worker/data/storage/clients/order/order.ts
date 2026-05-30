import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../../client.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../../../../shared/rpc/errors.js';
import { MenuItemStorageClient } from '../menu-item/menu-item.js';
import { getStationNamesByIds } from '../../../cache/stations.js';
import type { ICafeOrderDTO, IOrderItem, IRecentOrderSummary } from '@msdining/common/models/order';
import type { PrismaTransactionClient } from '../../../../../shared/models/prisma.js';
import { flattenModifiers, groupModifierRows, modifiersEqual } from '@msdining/common/util/modifier-util';
import { menuItemBaseToDTO } from '@msdining/common/util/menu-item-serde';
import type { IMenuItemBase } from '@msdining/common/models/cafe';
import { hashOrderItems, toOrderItems } from '../../../util/order.js';
import type { OrderHistorySince } from '../../../../../shared/services/order.js';
import type { CafeOrder, CafeOrderItem, CafeOrderItemModifier } from '@prisma/client';

const ORDER_ITEMS_INCLUDE = {
    items: {
        include: {
            modifiers: {
                select: { modifierId: true, choiceId: true },
            },
        },
    },
} as const;

type OrderWithItems = CafeOrder & {
	items: Array<CafeOrderItem & {
		modifiers: Array<Pick<CafeOrderItemModifier, 'modifierId' | 'choiceId'>>;
	}>;
};

const enrichOrders = async (orders: OrderWithItems[]): Promise<ICafeOrderDTO[]> => {
    const allMenuItemIds = [...new Set(orders.flatMap(order => order.items.map(item => item.menuItemId)))];
    const menuItemResults = await Promise.all(
        allMenuItemIds.map(id => MenuItemStorageClient.retrieveMenuItemAsync(id)),
    );
    const menuItemsById = new Map<string, IMenuItemBase>();
    for (let i = 0; i < allMenuItemIds.length; i++) {
        const menuItem = menuItemResults[i];
        if (menuItem != null) {
            menuItemsById.set(allMenuItemIds[i]!, menuItem);
        }
    }

    // Bulk-fetch station names for all referenced stations
    const stationIds = [...new Set(
        Array.from(menuItemsById.values()).map(item => item.stationId),
    )];
    const stationNamesById = await getStationNamesByIds(stationIds);

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

            return [{
                menuItemId:          item.menuItemId,
                quantity:            item.quantity,
                price:               item.price,
                specialInstructions: item.specialInstructions,
                modifiers:           groupModifierRows(item.modifiers),
                stationName:         stationNamesById.get(menuItem.stationId),
                menuItem:            {
                    ...menuItemBaseToDTO(menuItem),
                    totalReviewCount: 0,
                    overallRating:    0,
                    firstAppearance:  '',
                },
            }];
        }),
    }));
};

const getSinceDate = (since: OrderHistorySince): Date | null => {
    if (since === 'all') {
        return null;
    }
    const date = new Date();
    if (since === 'today') {
        date.setHours(0, 0, 0, 0);
        return date;
    }
    const days = since === '7d' ? 7 : 30;
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
};

export abstract class OrderStorageClient {
    /**
	 * Creates a PendingCafeOrder with item snapshots, or returns an existing
	 * one if there's already a pending order for this user+cafe with the same items.
	 */
    static async getOrCreatePendingOrder(
        userId: string,
        cafeId: string,
        items: IOrderItem[],
    ): Promise<string> {
        if (items.length === 0) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Order must contain at least one item');
        }

        const itemsHash = hashOrderItems(items);

        return usePrismaTransaction(async prisma => {
            const existing = await prisma.pendingCafeOrder.findFirst({
                where:  { userId, cafeId, itemsHash },
                select: { id: true },
            });

            if (existing) {
                return existing.id;
            }

            const created = await prisma.pendingCafeOrder.create({
                data: {
                    userId,
                    cafeId,
                    itemsHash,
                    items: {
                        create: items.map(item => ({
                            menuItemId:          item.menuItemId,
                            quantity:            item.quantity,
                            specialInstructions: item.specialInstructions ?? null,
                            modifiers: {
                                create: flattenModifiers(item.modifiers),
                            },
                        })),
                    },
                },
                select: { id: true },
            });

            return created.id;
        });
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

    /**
	 * Atomically: verifies ownership, creates CafeOrder from pending order,
	 * deducts matching items from the user's cart, and deletes the pending order.
	 */
    static async createCompletedOrder(
        pendingOrderId: string,
        userId: string,
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
        await usePrismaTransaction(async prisma => {
            const pendingOrder = await prisma.pendingCafeOrder.findUnique({
                where:   { id: pendingOrderId },
                include: ORDER_ITEMS_INCLUDE,
            });

            if (!pendingOrder) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Pending order not found');
            }

            if (pendingOrder.userId !== userId) {
                throw new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'Pending order does not belong to this user');
            }

            const menuItemIds = [...new Set(pendingOrder.items.map(item => item.menuItemId))];
            const menuItems = await prisma.menuItem.findMany({
                where:  { id: { in: menuItemIds } },
                select: { id: true, name: true, price: true },
            });
            const menuItemsById = new Map(menuItems.map(item => [item.id, item]));

            await prisma.cafeOrder.create({
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

            // Deduct ordered items from cart
            const orderedItems = toOrderItems(pendingOrder.items);
            await this.deductFromCartInTransaction(prisma, pendingOrder.userId, orderedItems);

            await prisma.pendingCafeOrder.delete({ where: { id: pendingOrderId } });
        });
    }

    private static async deductFromCartInTransaction(
        prisma: PrismaTransactionClient,
        userId: string,
        items: IOrderItem[],
    ): Promise<void> {
        const cartItems = await prisma.cartItem.findMany({
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
				&& modifiersEqual(item.modifiers, cartItem.modifierChoices),
            );

            if (matchIndex === -1) {
                continue;
            }

            const cartItem = cartItems[matchIndex]!;
            if (cartItem.quantity > item.quantity) {
                cartItem.quantity -= item.quantity;
                await prisma.cartItem.update({
                    where: { id: cartItem.id },
                    data:  { quantity: cartItem.quantity },
                });
                continue;
            }

            cartItems.splice(matchIndex, 1);
            await prisma.cartItem.delete({ where: { id: cartItem.id } });
        }
    }

    static async getRecentOrders(userId: string): Promise<IRecentOrderSummary[]> {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const orders = await usePrismaClient(prisma => prisma.cafeOrder.findMany({
            where: {
                userId,
                completedAt: { gte: thirtyMinutesAgo },
            },
            select: {
                cafeId:                 true,
                buyOnDemandOrderNumber: true,
                completedAt:            true,
            },
            orderBy: { completedAt: 'desc' },
        }));

        return orders.map(orderData => ({
            cafeId:      orderData.cafeId,
            orderNumber: orderData.buyOnDemandOrderNumber,
            completedAt: orderData.completedAt,
        }));
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

        return enrichOrders(orders);
    }

    static async getOrderHistory(userId: string, since: OrderHistorySince): Promise<ICafeOrderDTO[]> {
        const sinceDate = getSinceDate(since);

        const orders = await usePrismaClient(prisma => prisma.cafeOrder.findMany({
            where: {
                userId,
                ...(sinceDate && { completedAt: { gte: sinceDate } }),
            },
            include: ORDER_ITEMS_INCLUDE,
            orderBy: { completedAt: 'desc' },
        }));

        return enrichOrders(orders);
    }

    static async getOrderCount(userId: string): Promise<number> {
        return usePrismaClient(prisma => prisma.cafeOrder.count({
            where: { userId },
        }));
    }

    static async removeOrphanedPendingOrders(activeIds: string[]): Promise<number> {
        return usePrismaWrite(async prisma => {
            const orphanedOrders = await prisma.pendingCafeOrder.deleteMany({
                where: {
                    id: {
                        notIn: activeIds
                    }
                }
            });

            return orphanedOrders.count;
        });
    }
}
