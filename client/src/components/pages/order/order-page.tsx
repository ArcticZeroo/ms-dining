import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafeOrderWarning } from '../../notice/multi-cafe-order-warning.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { PaymentInfoForm } from '../../order/payment/payment-info-form.tsx';

import './order-page.css';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);

    const isCheckoutAllowed = allowOnlineOrdering && cart.size > 0;

    if (!isCheckoutAllowed) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <div className="card dark-blue">
                <div className="title">
                    Your Order
                </div>
                <CartContentsTable showModifiers={true}/>
            </div>
            {cart.size > 1 && <MultiCafeOrderWarning/>}
            <PaymentInfoForm onSubmit={() => alert('This does nothing yet!')}/>
        </div>
    );
};