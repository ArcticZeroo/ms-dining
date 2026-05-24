import type { ICartService } from '../../../../shared/services/cart.js';
import type { ICartItemData, ICartItemUpdate } from '@msdining/common/models/cart';
import { CartStorageClient } from './cart.js';

export const cartServiceCommands = {
    getCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.getCart(userId),
    addItems: async ({ userId, items }: { userId: string; items: ICartItemData[] }) =>
        CartStorageClient.addItems(userId, items),
    updateItem: async ({ userId, itemId, update }: { userId: string; itemId: string; update: ICartItemUpdate }) =>
        CartStorageClient.updateItem(userId, itemId, update),
    removeItem: async ({ userId, itemId }: { userId: string; itemId: string }) =>
        CartStorageClient.removeItem(userId, itemId),
    clearCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.clearCart(userId),
} satisfies ICartService;
