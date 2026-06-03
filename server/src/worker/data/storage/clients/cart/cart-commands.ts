import type { ICartService } from '../../../../../shared/services/cart.js';
import type { ICartItemData, ICartItemUpdate } from '@msdining/common/models/cart';
import { CartStorageClient } from './cart.js';
import { OrderOrchestrator } from '../../../ordering/order-orchestrator.js';

const withPrewarm = async (userId: string, mutation: () => ReturnType<typeof CartStorageClient.getCart>) => {
    const response = await mutation();
    OrderOrchestrator.prewarmFromCart(userId, response.cafes);
    return response;
};

export const cartServiceCommands = {
    getCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.getCart(userId),
    addItems: async ({ userId, items }: { userId: string; items: ICartItemData[] }) =>
        withPrewarm(userId, () => CartStorageClient.addItems(userId, items)),
    updateItem: async ({ userId, itemId, update }: { userId: string; itemId: string; update: ICartItemUpdate }) =>
        withPrewarm(userId, () => CartStorageClient.updateItem(userId, itemId, update)),
    removeItem: async ({ userId, itemId }: { userId: string; itemId: string }) =>
        withPrewarm(userId, () => CartStorageClient.removeItem(userId, itemId)),
    clearCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.clearCart(userId),
} satisfies ICartService;
