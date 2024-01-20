import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { Link } from 'react-router-dom';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafeOrderWarning } from '../../order/multi-cafe-order-warning.tsx';
import './order-page.css';

export const OrderPage = () => {
    const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);

    const isCheckoutAllowed = allowOnlineOrdering && cart.size > 0;

    if (!isCheckoutAllowed) {
        return (
            <div className="error-card">
                You must add items to your cart before checking out.
                <Link to="/" className="button">
                    Go Home
                </Link>
            </div>
        );
    }

    return (
        <div id="order-checkout" className="flex-col">
            { cart.size > 1 && <MultiCafeOrderWarning/> }
            <div className="card" id="cart">
                <div className="title">
                    Your Order
                </div>
                <CartContentsTable/>
            </div>
        </div>
    );
};