import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { RenderOptions } from '@testing-library/react';
import { type IPaymentIdentityContext, PaymentIdentityContext } from '../../src/context/payment-identity.ts';
import { type IPopupContext, PopupContext } from '../../src/context/modal.ts';
import { ValueNotifier } from '../../src/util/events.ts';
import { renderWithProviders } from './render.tsx';

export interface IAppRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    initialEntries?: string[];
    paymentIdentity?: IPaymentIdentityContext;
    popupNotifier?: ValueNotifier<IPopupContext | null>;
    routePath?: string;
}

const DEFAULT_ROUTE_PATH = '/order';

export const DEFAULT_PAYMENT_IDENTITY: IPaymentIdentityContext = {
    alias:           'Test Guest',
    phoneNumber:     '5555555555',
    isValid:         true,
    fulfillmentType: 'pickup',
};

/**
 * Builds a popup notifier suitable for PopupContext; tests can inspect or mutate
 * `.value` to assert popup opens or simulate closes.
 */
export const makePopupNotifier = () => new ValueNotifier<IPopupContext | null>(null);

/**
 * Renders under the frontend integration provider stack: TanStack Query,
 * PopupContext, PaymentIdentityContext, and a memory data router.
 */
export const renderWithAppProviders = (element: React.ReactElement, options: IAppRenderOptions = {}) => {
    const {
        initialEntries = [DEFAULT_ROUTE_PATH],
        paymentIdentity = DEFAULT_PAYMENT_IDENTITY,
        popupNotifier = makePopupNotifier(),
        routePath = DEFAULT_ROUTE_PATH,
        ...renderOptions
    } = options;

    const wrappedElement = (
        <PopupContext.Provider value={popupNotifier}>
            <PaymentIdentityContext.Provider value={paymentIdentity}>
                {element}
            </PaymentIdentityContext.Provider>
        </PopupContext.Provider>
    );

    const router = createMemoryRouter(
        [{ path: routePath, element: wrappedElement }],
        { initialEntries },
    );

    return {
        popupNotifier,
        router,
        ...renderWithProviders(<RouterProvider router={router}/>, renderOptions),
    };
};
