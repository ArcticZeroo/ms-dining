import { usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CartStorageClient } from './cart.js';
import type {
    PrismaTransactionClient,
    ReadOnlyPrismaLikeClient,
} from '../../../../shared/models/prisma.js';
import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';
import type { OrderCafePartStatus } from '@msdining/common/models/cart';

interface IOrderCafePartData {
    buyOnDemandOrderId?: string;
    buyOnDemandOrderNumber?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    waitTimeMin?: number;
    waitTimeMax?: number;
    lastError?: string;
    lastStage?: string;
    completedAt?: Date;
}

export abstract class OrderStorageClient {
    static async createOrderSession(userId: string) {
        return usePrismaTransaction(async tx => {
            // Reject if the user already has an active order
            const existing = await tx.orderSession.findFirst({
                where: {
                    userId,
                    cafeParts: {
                        some: { status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] } },
                    },
                },
                select: { id: true },
            });
            if (existing) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.CONFLICT,
                    'An active order already exists. Finish or abandon it before checking out again.',
                );
            }
            return tx.orderSession.create({ data: { userId } });
        });
    }

    /**
     * Transfers cart items to an order session, grouped by cafe.
     * Creates one OrderCafePart per cafe and reassigns the CartItem rows.
     * Returns the set of cafeIds that received items.
     */
    static async transferCart(userId: string, orderSessionId: string): Promise<string[]> {
        return usePrismaTransaction(async prisma => {
            const cartItems = await prisma.cartItem.findMany({
                where:   { cartUserId: userId },
                select:  { id: true, menuItem: { select: { cafeId: true } } },
            });

            if (cartItems.length === 0) {
                throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Cart is empty');
            }

            // Group cart item IDs by cafe
            const itemsByCafe = new Map<string, string[]>();
            for (const item of cartItems) {
                const cafeId = item.menuItem.cafeId;
                const ids = itemsByCafe.get(cafeId) ?? [];
                ids.push(item.id);
                itemsByCafe.set(cafeId, ids);
            }

            // Create a cafe part per cafe and transfer the items
            for (const [cafeId, itemIds] of itemsByCafe) {
                const cafePart = await prisma.orderCafePart.create({
                    data: { orderSessionId, cafeId },
                });
                await prisma.cartItem.updateMany({
                    where: { id: { in: itemIds } },
                    data:  { cartUserId: null, orderCafePartId: cafePart.id },
                });
            }

            return [...itemsByCafe.keys()];
        });
    }

    static async updateCafePartStatus(
        orderSessionId: string,
        cafeId: string,
        status: OrderCafePartStatus,
        data: IOrderCafePartData = {},
    ) {
        const { completedAt, ...restData } = data;

        return usePrismaWrite(prisma => prisma.orderCafePart.update({
            where: { orderSessionId_cafeId: { orderSessionId, cafeId } },
            data:  {
                status,
                ...restData,
                ...(status == 'completed'
                    ? { completedAt: completedAt ?? new Date() }
                    : completedAt != null
                        ? { completedAt }
                        : {}),
            },
        }));
    }

    static async getCafePart(
        client: ReadOnlyPrismaLikeClient,
        orderSessionId: string,
        cafeId: string,
    ) {
        const part = await client.orderCafePart.findUnique({
            where: { orderSessionId_cafeId: { orderSessionId, cafeId } },
            include: {
                items: {
                    include: { modifierChoices: { select: { modifierId: true, choiceId: true } } },
                },
            },
        });
        if (!part) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `No order part for cafe ${cafeId}`);
        }
        return part;
    }

    static async getOrderSession(
        client: ReadOnlyPrismaLikeClient,
        orderSessionId: string,
    ) {
        const order = await client.orderSession.findUnique({
            where:  { id: orderSessionId },
            select: { alias: true, phoneNumberWithCountryCode: true },
        });
        if (!order) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Order not found');
        }
        return order;
    }

    static async ensureOrderBelongsToUser(prismaTx: PrismaTransactionClient, orderSessionId: string, userId: string) {
        const order = await prismaTx.orderSession.findUnique({
            where:  { id: orderSessionId },
            select: { userId: true },
        });
        if (!order) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Order not found');
        }
        if (order.userId != userId) {
            throw new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'Order does not belong to this user');
        }
    }

    static async setPaymentIdentity(
        userId: string,
        orderSessionId: string,
        alias: string,
        phoneNumberWithCountryCode: string,
    ): Promise<void> {
        await usePrismaTransaction(async prismaTx => {
            await this.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);

            await prismaTx.orderSession.update({
                where: { id: orderSessionId },
                data:  { alias, phoneNumberWithCountryCode },
            });
        });
    }

    static async abandonOrder(userId: string, orderSessionId: string): Promise<void> {
        await usePrismaTransaction(async prismaTx => {
            await this.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);

            await prismaTx.orderCafePart.updateMany({
                where: {
                    orderSessionId,
                    status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                },
                data: { status: 'abandoned' },
            });
        });
    }

    static async getActiveOrder(userId: string) {
        return CartStorageClient.getActiveOrderSummary(userId);
    }
}
