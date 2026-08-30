import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { renderWithProviders } from './render.tsx';
import { usePaymentCoordinationEffects } from '../../src/hooks/payment-coordination-effects.ts';
import { type IPopupContext, PopupContext } from '../../src/context/modal.ts';
import { ValueNotifier } from '../../src/util/events.ts';
import { PAYMENT_POPUP_ID, usePaymentCoordinationStore } from '../../src/store/zustand/payment-coordination.ts';

const EffectsProbe = () => {
    usePaymentCoordinationEffects();
    return null;
};

const makePopupNotifier = () => new ValueNotifier<IPopupContext | null>(null);
const openPaymentPopup = (notifier: ValueNotifier<IPopupContext | null>) => {
    notifier.value = { id: PAYMENT_POPUP_ID, body: null, popHistoryOnClose: true };
};

const resetStore = () => {
    usePaymentCoordinationStore.setState({
        activeModal:       null,
        completingCafeIds: new Set(),
    });
};

const getActiveCafeId = () => usePaymentCoordinationStore.getState().activeModal?.cafeId ?? null;

// useBlocker (inside usePaymentCoordinationEffects) requires a data router, so we
// mount the probe under createMemoryRouter/RouterProvider at the #popup hash.
const renderEffects = (notifier: ValueNotifier<IPopupContext | null>, strict = false) => {
    const router = createMemoryRouter(
        [
            {
                path:    '/order',
                element: (
                    <PopupContext.Provider value={notifier}>
                        <EffectsProbe/>
                    </PopupContext.Provider>
                ),
            },
        ],
        { initialEntries: ['/order#popup'] },
    );

    const tree = <RouterProvider router={router}/>;
    return renderWithProviders(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
};

describe('usePaymentCoordinationEffects — modal lock release', () => {
    beforeEach(resetStore);

    it('releases the lock when the payment modal closes', () => {
        const notifier = makePopupNotifier();
        openPaymentPopup(notifier);
        usePaymentCoordinationStore.getState().startPaymentFlow('cafe-a');

        renderEffects(notifier);
        assertLockHeld();

        // Close the modal (popup value cleared, as on a pop-close).
        act(() => {
            notifier.value = null;
        });
        expect(getActiveCafeId()).toBeNull();
    });

    it('keeps the lock across re-renders while the modal stays open', () => {
        const notifier = makePopupNotifier();
        openPaymentPopup(notifier);
        usePaymentCoordinationStore.getState().startPaymentFlow('cafe-a');

        renderEffects(notifier);

        // An unrelated store change re-renders the observer, but the modal route is
        // unchanged, so the lock must be retained (not a close transition).
        act(() => usePaymentCoordinationStore.getState().startCompleting('cafe-a'));
        assertLockHeld();
    });

    it('does not release on mount under StrictMode', () => {
        const notifier = makePopupNotifier();
        openPaymentPopup(notifier);
        usePaymentCoordinationStore.getState().startPaymentFlow('cafe-a');

        // StrictMode double-invokes effects (setup→cleanup→setup) on mount. Because
        // release is driven by the route transition — not the effect cleanup — the
        // lock must survive mount.
        renderEffects(notifier, true);
        assertLockHeld();
    });

    it('does not release if the modal never opened', () => {
        const notifier = makePopupNotifier(); // stays closed
        usePaymentCoordinationStore.getState().startPaymentFlow('cafe-a');

        renderEffects(notifier);
        // Never opened → this observer never releases (prepare-failure path does).
        assertLockHeld();
    });
});

function assertLockHeld() {
    expect(getActiveCafeId()).toBe('cafe-a');
}
