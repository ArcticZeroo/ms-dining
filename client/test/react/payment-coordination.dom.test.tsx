import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from './render.tsx';
import {
    useIsOtherPaymentActive,
    usePaymentCoordinationStore,
} from '../../src/store/zustand/payment-coordination.ts';

interface IPayProbeProps {
    cafeId: string;
}

// Minimal stand-in for the real Pay button: mirrors how ReadyToPayFooter disables
// itself when another cafe holds the payment lock.
const PayProbe: React.FC<IPayProbeProps> = ({ cafeId }) => {
    const isOtherPaymentActive = useIsOtherPaymentActive(cafeId);
    return <button disabled={isOtherPaymentActive}>Pay</button>;
};

const resetStore = () => {
    usePaymentCoordinationStore.setState({
        activeModal:       null,
        completingCafeIds: new Set(),
    });
};

const getPayButton = () => screen.getByRole('button', { name: 'Pay' });

describe('payment coordination — rendered Pay button', () => {
    beforeEach(resetStore);

    it('is enabled when no payment is active', () => {
        renderWithProviders(<PayProbe cafeId="cafe-a"/>);
        expect(getPayButton()).toBeEnabled();
    });

    it('disables when another cafe takes the payment lock', () => {
        renderWithProviders(<PayProbe cafeId="cafe-a"/>);
        act(() => usePaymentCoordinationStore.getState().startPaymentFlow('cafe-b'));
        expect(getPayButton()).toBeDisabled();
    });

    it('stays enabled for the cafe that owns the lock', () => {
        renderWithProviders(<PayProbe cafeId="cafe-a"/>);
        act(() => usePaymentCoordinationStore.getState().startPaymentFlow('cafe-a'));
        expect(getPayButton()).toBeEnabled();
    });

    it('re-enables once the other cafe releases the lock', () => {
        renderWithProviders(<PayProbe cafeId="cafe-a"/>);

        act(() => usePaymentCoordinationStore.getState().startPaymentFlow('cafe-b'));
        expect(getPayButton()).toBeDisabled();

        act(() => usePaymentCoordinationStore.getState().endPaymentFlow('cafe-b'));
        expect(getPayButton()).toBeEnabled();
    });

    it('does not disable other cafes just because one is completing', () => {
        renderWithProviders(<PayProbe cafeId="cafe-a"/>);
        // cafe-b's modal closed but its order is still being sent to the kitchen.
        act(() => usePaymentCoordinationStore.getState().startCompleting('cafe-b'));
        expect(getPayButton()).toBeEnabled();
    });
});
