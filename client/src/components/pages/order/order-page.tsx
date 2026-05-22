import { useNavigate } from 'react-router-dom';
import { useOnlineOrderingState } from '../../../hooks/cafe.ts';
import { useCheckoutFlow } from '../../../hooks/checkout-flow.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';
import { OrderPrivacyPolicy } from '../../notice/order-privacy-policy.tsx';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';
import { OrderStatus } from '../../order/status/order-status.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

import './order-page.css';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    return fallback;
};

const OrderPageBody = () => {
    const flow = useCheckoutFlow();
    const navigate = useNavigate();

    if (flow.phase === 'loading') {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your cart...
            </div>
        );
    }

    if (flow.phase === 'cart-error') {
        return (
            <div id="order-checkout" className="flex-col">
                <OnlineOrderingExperimental/>
                <div className="card error">
                    {getErrorMessage(flow.cartError, 'Failed to load your cart.')}
                    <RetryButton onClick={flow.retryCartLoad}/>
                </div>
            </div>
        );
    }

    if (flow.phase === 'empty') {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            {flow.phase === 'pre-checkout' && (
                <>
                    <div className="card dark-blue">
                        <div className="title">Your Order</div>
                        <CartContentsTable
                            showFullDetails={true}
                            showTotalPrice={true}
                            readOnly={flow.isCheckoutInitiated}
                        />
                    </div>
                    {flow.availableCafeCount > 1 && <MultiCafeOrderWarning/>}
                    <PaymentInfoForm
                        isPrepareStarted={flow.isCheckoutInitiated}
                        isCartReady={flow.hasAvailableItems}
                        onSubmit={flow.startCheckout}
                    />
                    <OrderPrivacyPolicy/>
                    {flow.isCheckoutPending && (
                        <div className="flex flex-justify-center">
                            <HourglassLoadingSpinner/>
                            Starting checkout...
                        </div>
                    )}
                </>
            )}
            {flow.checkoutError && (
                <div className="card error">
                    {flow.checkoutError}
                </div>
            )}
            {flow.phase === 'payment' && flow.currentOrderId && (
                <>
                    <div className="card dark-blue">
                        <div className="title">Order Summary</div>
                        <WaitTime checkoutResult={flow.checkoutResult} activeOrder={flow.activeOrder}/>
                    </div>
                    <MultiCafePayment
                        orderId={flow.currentOrderId}
                        cafes={flow.cafePayments}
                        isCancelling={flow.isCancelling}
                        onCompleted={flow.recordCafeCompleted}
                        onCancelOrder={flow.cancelOrder}
                    />
                </>
            )}
            {flow.phase === 'completed' && (
                <>
                    <OrderStatus items={flow.completedItems}/>
                    <div className="flex flex-justify-center">
                        <button className="default-container" onClick={() => navigate('/')}>
                            Return Home
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export const OrderPage = () => {
    const orderingState = useOnlineOrderingState();

    if (!orderingState.allowed) {
        return <OnlineOrderingUnavailableNotice state={orderingState}/>;
    }

    return <OrderPageBody/>;
};
