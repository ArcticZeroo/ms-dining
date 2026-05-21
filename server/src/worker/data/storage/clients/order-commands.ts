import type { IOrderService } from '../../../../shared/services/order.js';
import { OrderStorageClient } from './order.js';

export const orderServiceCommands = {
    checkout: async ({ userId }: { userId: string }) =>
        OrderStorageClient.checkout(userId),
    setPaymentIdentity: async ({ userId, orderSessionId, alias, phoneNumberWithCountryCode }: {
        userId: string; orderSessionId: string; alias: string; phoneNumberWithCountryCode: string;
    }) =>
        OrderStorageClient.setPaymentIdentity(userId, orderSessionId, alias, phoneNumberWithCountryCode),
    preparePayment: async ({ userId, orderSessionId, cafeId, iframeCssUrl }: {
        userId: string; orderSessionId: string; cafeId: string; iframeCssUrl: string;
    }) =>
        OrderStorageClient.preparePayment(userId, orderSessionId, cafeId, iframeCssUrl),
    completeOrder: async ({ userId, orderSessionId, cafeId, paymentToken, cardInfo }: {
        userId: string; orderSessionId: string; cafeId: string; paymentToken: string;
        cardInfo: { accountNumberMasked: string; cardIssuer: string; expirationYearMonth: string; cardHolderName: string; postalCode: string; };
    }) =>
        OrderStorageClient.completeOrder(userId, orderSessionId, cafeId, paymentToken, cardInfo),
    abandonOrder: async ({ userId, orderSessionId }: { userId: string; orderSessionId: string }) =>
        OrderStorageClient.abandonOrder(userId, orderSessionId),
    getActiveOrder: async ({ userId }: { userId: string }) =>
        OrderStorageClient.getActiveOrder(userId),
} satisfies IOrderService;
