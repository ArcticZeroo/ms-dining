import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { usePaymentIdentity } from '../../../hooks/payment-identity.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from './payment/order-cafe-card.tsx';
import { PaymentInfoForm } from './payment/payment-info-form.tsx';
import { TodayOrdersView } from './history/today-orders-view.js';
import { PaymentIdentityContext } from '../../../context/payment-identity.ts';

import './order-page.css';
import { usePageData } from '../../../hooks/location.js';

export const OrderCheckoutView = () => {
    const snapshot = useCartSnapshot();
    const { alias, phoneValidation, validatedPhoneNumber, setAlias, setPhoneNumber, isValid } = usePaymentIdentity();

    usePageData('Order', 'Online ordering checkout');

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
                <TodayOrdersView/>
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
            {
                snapshot.groupedItems.length > 1 && (
                    <MultiCafeOrderWarning/>
                )
            }
            <PaymentIdentityContext.Provider value={{ alias, phoneNumber: validatedPhoneNumber ?? '', isValid }}>
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
            <div className="centered-content">
                <Link to="/order/done" className="default-container default-button">
                    View Your Orders From Today
                </Link>
            </div>
            <div className="centered-content">
                <Link to="/order/history" className="default-container default-button">
                    Order History
                </Link>
            </div>
        </div>
    );
};
