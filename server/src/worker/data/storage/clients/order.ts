import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
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
    itemsJson?: string;
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

    static async createCafePart(
        orderSessionId: string,
        cafeId: string,
        data: IOrderCafePartData & { status: OrderCafePartStatus },
    ) {
        return usePrismaWrite(prisma => prisma.orderCafePart.create({
            data: {
                orderSessionId,
                cafeId,
                ...data,
            },
        }));
    }

    static async updateCafePartStatus(
        orderSessionId: string,
        cafeId: string,
        status: OrderCafePartStatus,
        data: IOrderCafePartData = {},
    ) {
        return usePrismaWrite(prisma => prisma.orderCafePart.updateMany({
            where: { orderSessionId, cafeId },
            data:  { status, ...data },
        }));
    }

    static async getCafePart(
        client: ReadOnlyPrismaLikeClient,
        orderSessionId: string,
        cafeId: string,
    ) {
        const part = await client.orderCafePart.findFirst({
            where: { orderSessionId, cafeId },
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

            const advancedParts = await prismaTx.orderCafePart.findFirst({
                where: {
                    orderSessionId,
                    status: { not: 'pending' },
                },
                select: { id: true },
            });
            if (advancedParts) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.CONFLICT,
                    'Cannot change payment identity after payment has been prepared. Abandon the order and try again.',
                );
            }

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
