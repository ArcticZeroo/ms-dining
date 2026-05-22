import { useCallback, useState } from 'react';
import { InternalSettings } from '../../../constants/settings.ts';
import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { validatePhoneNumber } from '../../../util/validation.ts';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from '../../order/payment/order-cafe-card.tsx';
import { CompletedCafesList } from '../../order/status/completed-cafes-list.tsx';
import {
    PaymentInfoForm,
    type IPaymentFormData,
} from '../../order/payment/payment-info-form.tsx';

import './order-page.css';

const getInitialPaymentInfo = (): IPaymentFormData => {
    const alias = InternalSettings.alias.value;
    const phoneNumber = validatePhoneNumber(InternalSettings.phoneNumber.value);

    return {
        alias,
        phoneNumberWithCountryCode: phoneNumber.isValid ? phoneNumber.parsedValue : null,
        isValid:                    phoneNumber.isValid && alias.trim().length > 0,
    };
};

export const OrderPageBody = () => {
    const snapshot = useCartSnapshot();
    const [paymentInfo, setPaymentInfo] = useState<IPaymentFormData>(getInitialPaymentInfo);

    const getPaymentIdentity = useCallback(() => {
        if (!paymentInfo.isValid || paymentInfo.phoneNumberWithCountryCode == null) {
            return null;
        }

        return {
            alias:       paymentInfo.alias,
            phoneNumber: paymentInfo.phoneNumberWithCountryCode,
        };
    }, [paymentInfo]);

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
                onChange={setPaymentInfo}
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
                            getPaymentIdentity={getPaymentIdentity}
                            onCompleted={snapshot.setCafeCompleted}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
