import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type { FulfillmentType, ICompleteOrderResult, IOrderItem, IPreparePaymentResult } from '@msdining/common/models/order';
import { type SpyInstance, vi } from 'vitest';
import { OrderClient } from '../../src/api/ordering.ts';
import { deferred, type IDeferred } from './deferred.ts';

export interface IOrderingMutationMockOptions {
    preparePayment?: IDeferred<IPreparePaymentResult>;
    completeOrder?: IDeferred<ICompleteOrderResult>;
}

export interface IOrderingMutationMocks {
    preparePayment: IDeferred<IPreparePaymentResult>;
    completeOrder: IDeferred<ICompleteOrderResult>;
    preparePaymentSpy: SpyInstance<PreparePaymentCall, Promise<IPreparePaymentResult>>;
    completeOrderSpy: SpyInstance<CompleteOrderCall, Promise<ICompleteOrderResult>>;
}

/**
 * Installs OrderClient spies used by TanStack mutation hooks while exposing
 * deferred promises so tests can drive pending, resolved, and rejected states.
 */
export const mockOrderingMutations = (options: IOrderingMutationMockOptions = {}): IOrderingMutationMocks => {
    const preparePayment = options.preparePayment ?? deferred<IPreparePaymentResult>();
    const completeOrder = options.completeOrder ?? deferred<ICompleteOrderResult>();

    const preparePaymentSpy = vi.spyOn(OrderClient, 'preparePayment')
        .mockImplementation(() => preparePayment.promise);
    const completeOrderSpy = vi.spyOn(OrderClient, 'completeOrder')
        .mockImplementation(() => completeOrder.promise);

    return {
        preparePayment,
        completeOrder,
        preparePaymentSpy,
        completeOrderSpy,
    };
};

/**
 * Creates a valid prepare-payment response; override fields that matter for a
 * specific popup or completion assertion.
 */
export const makePreparePaymentResult = (overrides: Partial<IPreparePaymentResult> = {}): IPreparePaymentResult => ({
    pendingOrderId:         'pending-order-id',
    siteToken:              'site-token',
    iframeUrl:              'https://pay.rguest.com/payment-frame',
    buyOnDemandOrderId:     'buy-on-demand-order-id',
    buyOnDemandOrderNumber: '123',
    expiresAt:              new Date('2030-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
});

/**
 * Creates a valid complete-order response for tests that drive the payment
 * success path through useCompleteOrderMutation.
 */
export const makeCompleteOrderResult = (overrides: Partial<ICompleteOrderResult> = {}): ICompleteOrderResult => ({
    buyOnDemandOrderNumber: '123',
    buyOnDemandOrderId:     'buy-on-demand-order-id',
    waitTimeMin:            5,
    waitTimeMax:            10,
    completedAt:            new Date('2030-01-01T00:05:00.000Z'),
    ...overrides,
});

/**
 * Mirrors the OrderClient.completeOrder argument list for reusable assertions
 * without reaching through TanStack Query internals.
 */
export type CompleteOrderCall = [
    pendingOrderId: string,
    paymentToken: string,
    cardInfo: IPaymentCardInfo,
    alias: string,
    phoneNumber: string,
    fulfillmentType?: FulfillmentType,
];

/**
 * Mirrors the OrderClient.preparePayment argument list for reusable assertions
 * without reaching through TanStack Query internals.
 */
export type PreparePaymentCall = [cafeId: string, items: IOrderItem[]];
