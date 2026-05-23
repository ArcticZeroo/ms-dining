import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { usePaymentIdentity } from '../../../hooks/payment-identity.ts';
import { useCompletedOrdersTodayQuery } from '../../../store/queries/new-ordering.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from './payment/order-cafe-card.tsx';
import { CompletedOrdersList } from './status/completed-orders-list.tsx';
import { PaymentInfoForm } from './payment/payment-info-form.tsx';

import './order-page.css';

export const OrderPageBody = () => {
    const snapshot = useCartSnapshot();
    const { alias, phoneValidation, validatedPhoneNumber, setAlias, setPhoneNumber, isValid } = usePaymentIdentity();
    const completedOrdersQuery = useCompletedOrdersTodayQuery();

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
                    {getErrorMessage(snapshot.cartError, 'Failed to load your cart.')}
                </div>
            </div>
        );
    }

    const hasCartItems = snapshot.groupedItems.length > 0;

    // Empty cart: show completed orders inline
    if (!hasCartItems) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card dark-blue">
                    Your cart is empty. Add items from a cafe menu to get started.
                </div>
                {completedOrdersQuery.data != null && completedOrdersQuery.data.length > 0 && (
                    <>
                        <div className="card dark-blue">
                            <div className="title">Today&apos;s Orders</div>
                        </div>
                        <CompletedOrdersList orders={completedOrdersQuery.data}/>
                    </>
                )}
            </div>
        );
    }

    // Has cart items: show cafe cards + link to completed orders
    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <PaymentInfoForm
                alias={alias}
                phoneValidation={phoneValidation}
                onAliasChanged={setAlias}
                onPhoneNumberChanged={setPhoneNumber}
            />
            <div className="order-page-cafes">
                {snapshot.groupedItems.map((group) => (
                    <OrderCafeCard
                        key={group.cafeId}
                        cafeId={group.cafeId}
                        items={group.items}
                        paymentIdentity={{ alias, phoneNumber: validatedPhoneNumber ?? '' }}
                        isPayEnabled={isValid}
                        snapshotCallbacks={snapshotCallbacks}
                    />
                ))}
            </div>
            <Link to="/order/done" className="default-container default-button">
                View Today&apos;s Orders
            </Link>
        </div>
    );
};
