import { useCallback, useState } from 'react';
import { InternalSettings } from '../../../constants/settings.ts';
import { useCartSnapshot } from '../../../hooks/cart-snapshot.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCafeCard } from '../../order/payment/order-cafe-card.tsx';
import {
    CompletedCafesList,
    type ICompletedCafeSummary,
} from '../../order/status/completed-cafes-list.tsx';
import {
    PaymentInfoForm,
    type IPaymentInfoFormState,
    type IPaymentInfoFormValue,
} from '../../order/payment/payment-info-form.tsx';

import './order-page.css';

export const OrderPageBody = () => {
    const snapshot = useCartSnapshot();

    const [paymentInfo, setPaymentInfo] = useState<IPaymentInfoFormValue>({
        alias:       InternalSettings.alias.value,
        phoneNumber: InternalSettings.phoneNumber.value,
    });
    const [paymentInfoState, setPaymentInfoState] = useState<IPaymentInfoFormState>({
        ...paymentInfo,
        isValid: false,
    });
    const [completedCafes, setCompletedCafes] = useState<ICompletedCafeSummary[]>([]);

    const getPaymentIdentity = useCallback(() => {
        if (!paymentInfoState.isValid || paymentInfoState.phoneNumberWithCountryCode == null) {
            return null;
        }

        InternalSettings.alias.value = paymentInfo.alias;
        InternalSettings.phoneNumber.value = paymentInfoState.phoneNumberWithCountryCode;

        return {
            alias:       paymentInfo.alias,
            phoneNumber: paymentInfoState.phoneNumberWithCountryCode,
        };
    }, [paymentInfo, paymentInfoState]);

    const handleCafeCompleted = useCallback((cafeId: string, buyOnDemandOrderNumber: string) => {
        snapshot.removeCafeItems(cafeId);
        setCompletedCafes(previous => [
            ...previous.filter(item => item.cafeId !== cafeId),
            { cafeId, buyOnDemandOrderNumber },
        ]);
    }, [snapshot]);

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

    if (snapshot.groupedItems.length === 0 && completedCafes.length === 0) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <PaymentInfoForm
                isPrepareStarted={false}
                isCartReady={snapshot.groupedItems.length > 0}
                value={paymentInfo}
                onValueChanged={setPaymentInfo}
                onValidationChanged={setPaymentInfoState}
                hideSubmit={true}
            />
            <CompletedCafesList completedCafes={completedCafes}/>
            {snapshot.groupedItems.length === 0 ? (
                <div className="card dark-blue">
                    <div className="title">All Cafes Paid</div>
                    <div>Your current checkout snapshot is complete.</div>
                </div>
            ) : (
                <div className="order-page-cafes">
                    {snapshot.groupedItems.map((group) => (
                        <OrderCafeCard
                            key={group.cafeId}
                            cafeId={group.cafeId}
                            items={group.items}
                            isBusy={false}
                            getPaymentIdentity={getPaymentIdentity}
                            onCompleted={handleCafeCompleted}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
