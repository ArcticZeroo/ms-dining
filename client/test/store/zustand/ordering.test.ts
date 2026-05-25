import { IPreparePaymentResponse } from '../../../src/api/order.ts';
import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';
import { IPaymentFormData, useOrderingStore } from '../../../src/store/zustand/ordering.ts';

const makeFormData = (overrides: Partial<IPaymentFormData> = {}): IPaymentFormData => ({
    phoneNumberWithCountryCode: '+15551234567',
    alias:                      'tester',
    ...overrides,
});

const makePrepare = (overrides: Partial<IPreparePaymentResponse> = {}): IPreparePaymentResponse => ({
    siteToken:   'site-token',
    iframeUrl:   'https://pay.rguest.com/?session=abc',
    orderId:     'order-1',
    orderNumber: '1001',
    expiresAt:   new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
});

const reset = () => useOrderingStore.getState().reset();

describe('useOrderingStore', () => {
    beforeEach(reset);

    describe('startCheckout', () => {
        it('populates payments map and stores form data', () => {
            useOrderingStore.getState().startCheckout(makeFormData({ alias: 'foo' }), {
                'cafe-a': makePrepare({ orderId: 'order-a', iframeUrl: 'url-a' }),
                'cafe-b': makePrepare({ orderId: 'order-b', iframeUrl: 'url-b' }),
            });

            const state = useOrderingStore.getState();
            assert.strictEqual(state.formData?.alias, 'foo');
            assert.strictEqual(state.paymentsByCafeId.size, 2);
            assert.deepStrictEqual(state.paymentsByCafeId.get('cafe-a'), {
                orderId:          'order-a',
                iframeUrl:        'url-a',
                completionResult: undefined,
                error:            undefined,
            });
        });

        it('clears prior completion results (fresh checkout)', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-a': makePrepare() });
            useOrderingStore.getState().recordCompletion('cafe-a', {
                orderNumber: '1',
                waitTimeMin: '5',
                waitTimeMax: '7',
            });

            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-b': makePrepare() });

            const state = useOrderingStore.getState();
            assert.strictEqual(state.paymentsByCafeId.has('cafe-a'), false);
            assert.strictEqual(state.paymentsByCafeId.get('cafe-b')?.completionResult, undefined);
        });
    });

    describe('setIframeUrl', () => {
        it('updates a slice and clears any prior error', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-a': makePrepare({ iframeUrl: 'old' }) });
            useOrderingStore.getState().setError('cafe-a', 'boom');

            useOrderingStore.getState().setIframeUrl('cafe-a', 'fresh');

            const slice = useOrderingStore.getState().paymentsByCafeId.get('cafe-a');
            assert.strictEqual(slice?.iframeUrl, 'fresh');
            assert.strictEqual(slice?.error, undefined);
        });

        it('accepts undefined to invalidate the iframe URL', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-a': makePrepare({ iframeUrl: 'old' }) });

            useOrderingStore.getState().setIframeUrl('cafe-a', undefined);

            assert.strictEqual(useOrderingStore.getState().paymentsByCafeId.get('cafe-a')?.iframeUrl, undefined);
        });

        it('is a no-op for an unknown cafe', () => {
            useOrderingStore.getState().setIframeUrl('cafe-missing', 'whatever');

            assert.strictEqual(useOrderingStore.getState().paymentsByCafeId.size, 0);
        });
    });

    describe('recordCompletion', () => {
        it('records the result and clears any prior error', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-a': makePrepare() });
            useOrderingStore.getState().setError('cafe-a', 'declined');

            const completion = { orderNumber: '1001', waitTimeMin: '5', waitTimeMax: '7' };
            useOrderingStore.getState().recordCompletion('cafe-a', completion);

            const slice = useOrderingStore.getState().paymentsByCafeId.get('cafe-a');
            assert.deepStrictEqual(slice?.completionResult, completion);
            assert.strictEqual(slice?.error, undefined);
        });

        it('is a no-op for an unknown cafe', () => {
            useOrderingStore.getState().recordCompletion('cafe-missing', { orderNumber: '1', waitTimeMin: '5', waitTimeMax: '7' });

            assert.strictEqual(useOrderingStore.getState().paymentsByCafeId.size, 0);
        });
    });

    describe('reset', () => {
        it('wipes form data and payments', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), { 'cafe-a': makePrepare() });

            useOrderingStore.getState().reset();

            const state = useOrderingStore.getState();
            assert.strictEqual(state.formData, undefined);
            assert.strictEqual(state.paymentsByCafeId.size, 0);
        });
    });
});

describe('ordering store selectors', () => {
    beforeEach(reset);

    // The selectors are exported as hooks (useAllCafesComplete / useCompletionResults),
    // but their underlying selector functions also run against raw state without
    // any React work. Test the behavior by reading state directly.

    const allCafesComplete = (): boolean => {
        const state = useOrderingStore.getState();
        if (state.paymentsByCafeId.size === 0) {
            return false;
        }
        for (const slice of state.paymentsByCafeId.values()) {
            if (slice.completionResult == null) {
                return false;
            }
        }
        return true;
    };

    describe('all-cafes-complete behavior', () => {
        it('is false when no checkout has been started', () => {
            assert.strictEqual(allCafesComplete(), false);
        });

        it('is false when some cafes are still outstanding', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), {
                'cafe-a': makePrepare({ orderId: 'order-a' }),
                'cafe-b': makePrepare({ orderId: 'order-b' }),
            });
            useOrderingStore.getState().recordCompletion('cafe-a', { orderNumber: '1', waitTimeMin: '5', waitTimeMax: '7' });

            assert.strictEqual(allCafesComplete(), false);
        });

        it('is true once every cafe has a completion result', () => {
            useOrderingStore.getState().startCheckout(makeFormData(), {
                'cafe-a': makePrepare({ orderId: 'order-a' }),
                'cafe-b': makePrepare({ orderId: 'order-b' }),
            });
            useOrderingStore.getState().recordCompletion('cafe-a', { orderNumber: '1', waitTimeMin: '5', waitTimeMax: '7' });
            useOrderingStore.getState().recordCompletion('cafe-b', { orderNumber: '2', waitTimeMin: '5', waitTimeMax: '7' });

            assert.strictEqual(allCafesComplete(), true);
        });
    });
});
