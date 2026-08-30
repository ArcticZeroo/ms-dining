import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useCafePaymentFlow } from '../../src/hooks/cafe-payment-flow.tsx';
import { usePaymentCoordinationEffects } from '../../src/hooks/payment-coordination-effects.ts';
import { PAYMENT_POPUP_ID, usePaymentCoordinationStore } from '../../src/store/zustand/payment-coordination.ts';
import { renderWithAppProviders } from './app-render.tsx';
import { makePreparePaymentResult, mockOrderingMutations } from './ordering-mutation-mocks.ts';

const CAFE_ID = 'cafe-a';

interface ICafePaymentFlowProbeProps {
    cafeId: string;
    items: ICartItemRecord[];
}

const CafePaymentFlowProbe: React.FC<ICafePaymentFlowProbeProps> = ({ cafeId, items }) => {
    usePaymentCoordinationEffects();
    const { handlePay, paymentState } = useCafePaymentFlow({ cafeId, items });

    return (
        <>
            <button type="button" onClick={handlePay}>Pay</button>
            <output aria-label="payment-state">{paymentState.status}</output>
        </>
    );
};

const makeCartItem = (overrides: Partial<ICartItemRecord> = {}): ICartItemRecord => ({
    id:                  'cart-item-id',
    menuItemId:          'menu-item-id',
    quantity:            1,
    modifiers:           [],
    specialInstructions: null,
    createdAt:           '2030-01-01T00:00:00.000Z',
    updatedAt:           '2030-01-01T00:00:00.000Z',
    menuItem:            {
        id:              'menu-item-id',
        cafeId:          CAFE_ID,
        stationId:       'station-id',
        price:           1,
        name:            'Test Item',
        receiptText:     null,
        calories:        100,
        maxCalories:     100,
        hasThumbnail:    false,
        modifiers:       [],
        imageUrl:        null,
        description:     'A test item',
        lastUpdateTime:  null,
        tags:            new Set(),
        searchTags:      new Set(),
        entityKey:       'test-item',
    },
    isAvailable:         true,
    ...overrides,
});

const getActiveModal = () => usePaymentCoordinationStore.getState().activeModal;
const getPayButton = () => screen.getByRole('button', { name: 'Pay' });

const resetPaymentCoordinationStore = () => {
    usePaymentCoordinationStore.setState({
        activeModal:       null,
        completingCafeIds: new Set(),
    });
};

describe('useCafePaymentFlow', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        resetPaymentCoordinationStore();
    });

    it('releases the modal lock and skips opening the popup when unmounted during prepare', async () => {
        const orderingMocks = mockOrderingMutations();
        const { popupNotifier, unmount } = renderWithAppProviders(
            <CafePaymentFlowProbe cafeId={CAFE_ID} items={[makeCartItem()]}/>,
        );

        await act(async () => {
            getPayButton().click();
        });

        await waitFor(() => expect(orderingMocks.preparePaymentSpy).toHaveBeenCalledOnce());
        expect(getActiveModal()?.cafeId).toBe(CAFE_ID);
        expect(popupNotifier.value).toBeNull();

        unmount();

        await act(async () => {
            orderingMocks.preparePayment.resolve(makePreparePaymentResult());
            await orderingMocks.preparePayment.promise;
        });

        await waitFor(() => expect(getActiveModal()).toBeNull());
        expect(popupNotifier.value).toBeNull();
    });

    it('opens the popup after prepare while mounted and holds the lock until close', async () => {
        const orderingMocks = mockOrderingMutations();
        const { popupNotifier } = renderWithAppProviders(
            <CafePaymentFlowProbe cafeId={CAFE_ID} items={[makeCartItem()]}/>,
        );

        await act(async () => {
            getPayButton().click();
        });

        await waitFor(() => expect(orderingMocks.preparePaymentSpy).toHaveBeenCalledOnce());
        expect(getActiveModal()?.cafeId).toBe(CAFE_ID);
        expect(popupNotifier.value).toBeNull();

        await act(async () => {
            orderingMocks.preparePayment.resolve(makePreparePaymentResult());
            await orderingMocks.preparePayment.promise;
        });

        await waitFor(() => expect(popupNotifier.value?.id).toBe(PAYMENT_POPUP_ID));
        expect(getActiveModal()?.cafeId).toBe(CAFE_ID);

        act(() => {
            popupNotifier.value = null;
        });

        await waitFor(() => expect(getActiveModal()).toBeNull());
    });
});
