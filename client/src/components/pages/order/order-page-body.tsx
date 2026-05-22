import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { usePaymentIdentity } from '../../../hooks/payment-identity.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from '../../order/payment/order-cafe-card.tsx';
import { CompletedCafesList } from '../../order/status/completed-cafes-list.tsx';
import { PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';

import './order-page.css';

export const OrderPageBody = () => {
    const snapshot = useCartSnapshot();
    const identity = usePaymentIdentity();

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

    if (snapshot.groupedItems.length === 0 && snapshot.completedCafes.length === 0) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <PaymentInfoForm
                alias={identity.alias}
                phoneNumber={identity.phoneNumber}
                onAliasChanged={identity.setAlias}
                onPhoneNumberChanged={identity.setPhoneNumber}
                readOnly={snapshot.groupedItems.length === 0}
            />
            <CompletedCafesList completedCafes={snapshot.completedCafes}/>
            {snapshot.groupedItems.length > 0 && (
                <div className="order-page-cafes">
                    {snapshot.groupedItems.map((group) => (
                        <OrderCafeCard
                            key={group.cafeId}
                            cafeId={group.cafeId}
                            items={group.items}
                            isBusy={false}
                            getPaymentIdentity={identity.getIdentity}
                            onCompleted={snapshot.setCafeCompleted}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
