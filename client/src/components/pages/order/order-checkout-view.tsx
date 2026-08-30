import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FulfillmentType } from '@msdining/common/models/order';
import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { usePaymentIdentity } from '../../../hooks/payment-identity.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from './payment/order-cafe-card.tsx';
import { OrderMetadataForm } from './payment/order-metadata-form.tsx';
import { OrderHistoryBody } from './history/order-history-body.tsx';
import { PaymentIdentityContext } from '../../../context/payment-identity.ts';
import { useOrderHistoryQuery, usePrewarmKeepalive } from '../../../store/queries/ordering.ts';
import { usePageData } from '../../../hooks/location.js';
import { usePaymentCoordinationEffects } from '../../../hooks/payment-coordination-effects.ts';
import { OnlineOrderingPrivacy } from '../../notice/online-ordering-privacy.js';
import { useValueNotifier } from '../../../hooks/events.ts';
import { DebugSettings } from '../../../constants/settings.ts';

import './order-page.css';
import { OrderAdblockWarning } from './order-adblock-warning.js';

const InlineTodayOrders = () => {
    const historyQuery = useOrderHistoryQuery('today');

    return (
        <OrderHistoryBody
            orders={historyQuery.data ?? []}
            isLoading={historyQuery.isPending}
            isFetching={historyQuery.isFetching}
            isError={historyQuery.isError}
            error={historyQuery.error}
            onRetry={() => historyQuery.refetch()}
        />
    );
};

// eslint-disable-next-line react/no-multi-comp -- InlineTodayOrders is a co-located query wrapper used only here
export const OrderCheckoutView = () => {
    const snapshot = useCartSnapshot();
    const { alias, phoneValidation, validatedPhoneNumber, setAlias, setPhoneNumber, isValid } = usePaymentIdentity();
    const isDineInEnabled = useValueNotifier(DebugSettings.enableDineInOrdering);
    const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');

    usePrewarmKeepalive();
    usePageData('Order', 'Online ordering checkout');
    // Owns the cross-cafe payment guards (unload, modal-close confirm, lock
    // release) for the whole checkout. Called before any early return.
    usePaymentCoordinationEffects();

    const snapshotCallbacks = useMemo(() => ({
        removeItem: snapshot.removeItem,
        updateItem: snapshot.updateItem,
    }), [snapshot.removeItem, snapshot.updateItem]);

    if (snapshot.isLoading) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    <span>Loading your cart...</span>
                </div>
            </div>
        );
    }

    if (snapshot.isError) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card error">
                    {getErrorMessage(snapshot.cartError, 'Failed to load your cart')}
                </div>
            </div>
        );
    }

    const hasCartItems = snapshot.groupedItems.length > 0;

    // Empty cart: show completed orders inline
    if (!hasCartItems) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card yellow text-center">
                    Your cart is empty. Add items from a cafe menu to get started.
                </div>
                <div className="centered-content">
                    <Link to="/order/history" className="default-container default-button">
                        Order History
                    </Link>
                </div>
                <InlineTodayOrders/>
            </div>
        );
    }

    // Has cart items: show cafe cards + link to completed orders
    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <OrderAdblockWarning/>
            <OrderMetadataForm
                alias={alias}
                phoneValidation={phoneValidation}
                onAliasChanged={setAlias}
                onPhoneNumberChanged={setPhoneNumber}
                fulfillmentType={fulfillmentType}
                onFulfillmentTypeChanged={setFulfillmentType}
                showFulfillmentTypeSelector={isDineInEnabled}
            />
            {
                snapshot.groupedItems.length > 1 && (
                    <MultiCafeOrderWarning/>
                )
            }
            <OnlineOrderingPrivacy/>
            <PaymentIdentityContext.Provider value={{ alias, phoneNumber: validatedPhoneNumber ?? '', isValid, fulfillmentType }}>
                <div className="flex-col">
                    {snapshot.groupedItems.map((group) => (
                        <OrderCafeCard
                            key={group.cafeId}
                            cafeId={group.cafeId}
                            items={group.items}
                            availability={group.availability}
                            snapshotCallbacks={snapshotCallbacks}
                        />
                    ))}
                </div>
            </PaymentIdentityContext.Provider>
            <div className="flex flex-center">
                <Link to="/order/history?range=today" className="default-container default-button">
                    Order History
                </Link>
            </div>
        </div>
    );
};
