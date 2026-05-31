import { usePrismaTransaction } from '../../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../../../shared/rpc/errors.js';
import { MenuItemStorageClient } from '../menu-item/menu-item.js';
import { getStationNamesByIds } from '../../../cache/stations.js';
import { StationStorageClient } from '../station/station.js';
import { toDateString } from '@msdining/common/util/date-util';
import { groupModifierRows } from '@msdining/common/util/modifier-util';
import { getShutdownCafeStateAsync } from '../../../cache/daily-cafe-state.js';
import { getAvailableMenuItemIds } from '../../../cache/menu-item-availability.js';
import type { PrismaTransactionClient } from '../../../../../shared/models/prisma.js';
import type {
    ICafeAvailability,
    ICartItemData,
    ICartItemRecord,
    ICartItemUpdate,
    ICartResponse,
    ISerializedModifier,
} from '@msdining/common/models/cart';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

type PrismaCartItemWithModifiers = {
    id: string;
    menuItemId: string;
    quantity: number;
    specialInstructions: string | null;
    createdAt: Date;
    updatedAt: Date;
    modifierChoices: { modifierId: string; choiceId: string }[];
};

const toCartItemRecord = (
    item: PrismaCartItemWithModifiers,
    menuItem: IMenuItemBase,
    isAvailable: boolean,
    stationName?: string,
): ICartItemRecord => ({
    id:                  item.id,
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions,
    modifiers:           groupModifierRows(item.modifierChoices),
    createdAt:           item.createdAt.toISOString(),
    updatedAt:           item.updatedAt.toISOString(),
    menuItem,
    isAvailable,
    stationName,
});

const CART_ITEM_INCLUDE = {
    modifierChoices: {
        select: { modifierId: true, choiceId: true },
    },
} as const;

export abstract class CartStorageClient {

    private static async readRawCartData(prisma: PrismaTransactionClient, userId: string) {
        const cart = await prisma.cart.findUnique({
            where:   { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        });
        return { items: cart?.items ?? [] };
    }

    private static async enrichCartResponse(
        rawItems: Awaited<ReturnType<typeof CartStorageClient.readRawCartData>>['items'],
    ): Promise<ICartResponse> {
        if (rawItems.length === 0) {
            return { cafes: [] };
        }

        const todayString = toDateString(new Date());
        const menuItemIds = rawItems.map(i => i.menuItemId);
        const [availableIds, ...menuItems] = await Promise.all([
            getAvailableMenuItemIds(todayString),
            ...menuItemIds.map(id => MenuItemStorageClient.retrieveMenuItemAsync(id)),
        ]);

        // Bulk-fetch station names for all referenced menu items
        const stationIds = [...new Set(
            menuItems.filter((item): item is IMenuItemBase => item != null).map(item => item.stationId),
        )];
        const stationNamesById = await getStationNamesByIds(stationIds);

        const items: ICartItemRecord[] = [];
        for (let i = 0; i < rawItems.length; i++) {
            const raw = rawItems[i]!;
            const menuItem = menuItems[i];
            if (!menuItem) {
                continue;
            }
            items.push(toCartItemRecord(raw, menuItem, availableIds.has(raw.menuItemId), stationNamesById.get(menuItem.stationId)));
        }

        if (items.length === 0) {
            return { cafes: [] };
        }

        const itemsByCafeId = new Map<string, ICartItemRecord[]>();
        for (const item of items) {
            const cafeId = item.menuItem.cafeId;
            const existing = itemsByCafeId.get(cafeId);
            if (existing) {
                existing.push(item);
            } else {
                itemsByCafeId.set(cafeId, [item]);
            }
        }

        const cafeIds = [...itemsByCafeId.keys()];
        const [shutdownCafeStates, ...hoursByCafe] = await Promise.all([
            getShutdownCafeStateAsync(todayString),
            ...cafeIds.map(cafeId => StationStorageClient.getCafeHoursAsync(cafeId, todayString)),
        ]);

        return {
            cafes: cafeIds.map((cafeId, index) => {
                const shutdown = shutdownCafeStates[cafeId];
                const hours = hoursByCafe[index] ?? null;

                let availability: ICafeAvailability;
                if (shutdown !== undefined) {
                    availability = hours !== null
                        ? { status: 'shutdown', shutdown, hours }
                        : { status: 'shutdown', shutdown };
                } else if (hours !== null) {
                    availability = { status: 'open', hours };
                } else {
                    availability = { status: 'unknown' };
                }

                return {
                    cafeId,
                    items: itemsByCafeId.get(cafeId)!,
                    availability,
                };
            }),
        };
    }

    private static readonly CART_WITH_ITEMS_INCLUDE = {
        items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } as const },
    };

    private static async getOrCreateCart(prisma: PrismaTransactionClient, userId: string) {
        return prisma.cart.upsert({
            where:   { userId },
            create:  { userId },
            update:  {},
            include: this.CART_WITH_ITEMS_INCLUDE,
        });
    }

    private static async useCartTransaction(
        userId: string,
        callback: (prisma: PrismaTransactionClient, cart: Awaited<ReturnType<typeof CartStorageClient.getOrCreateCart>>) => Promise<void>,
    ) {
        const rawData = await usePrismaTransaction(async prisma => {
            const cart = await this.getOrCreateCart(prisma, userId);
            await callback(prisma, cart);
            return this.readRawCartData(prisma, userId);
        });
        return this.enrichCartResponse(rawData.items);
    }

    private static async createModifierChoices(
        prisma: PrismaTransactionClient,
        cartItemId: string,
        modifiers: ISerializedModifier[],
    ): Promise<void> {
        const rows = modifiers.flatMap(mod =>
            mod.choiceIds.map(choiceId => ({
                cartItemId,
                modifierId: mod.modifierId,
                choiceId,
            })),
        );
        if (rows.length > 0) {
            await prisma.cartItemModifierChoice.createMany({ data: rows });
        }
    }

    static async getCart(userId: string) {
        return this.useCartTransaction(userId, async () => {});
    }

    static async addItems(userId: string, items: ICartItemData[]) {
        return this.useCartTransaction(userId, async (prisma, cart) => {
            for (const item of items) {
                const created = await prisma.cartItem.create({
                    data: {
                        cartUserId:          cart.userId,
                        menuItemId:          item.menuItemId,
                        quantity:            item.quantity,
                        specialInstructions: item.specialInstructions ?? null,
                    },
                });
                await this.createModifierChoices(prisma, created.id, item.modifiers);
            }
        });
    }

    static async updateItem(userId: string, itemId: string, update: ICartItemUpdate) {
        return this.useCartTransaction(userId, async (prisma, cart) => {
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }

            await prisma.cartItem.update({
                where: { id: itemId },
                data:  {
                    quantity:            update.quantity,
                    specialInstructions: update.specialInstructions,
                },
            });

            await prisma.cartItemModifierChoice.deleteMany({ where: { cartItemId: itemId } });
            await this.createModifierChoices(prisma, itemId, update.modifiers);
        });
    }

    static async removeItem(userId: string, itemId: string) {
        return this.useCartTransaction(userId, async (prisma, cart) => {
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }
            await prisma.cartItem.delete({ where: { id: itemId } });
        });
    }

    static async clearCart(userId: string) {
        return this.useCartTransaction(userId, async (prisma, cart) => {
            await prisma.cartItem.deleteMany({ where: { cartUserId: cart.userId } });
        });
    }
}

