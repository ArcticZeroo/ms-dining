import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useNavigate } from 'react-router-dom';
import { CartContentsTable } from '../../order/cart/cart-contents-table.tsx';
import { MultiCafeOrderWarning } from '../../order/multi-cafe-order-warning.tsx';
import './order-page.css';

export const OrderPage = () => {
    const navigate = useNavigate();
    const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);

    if (!allowOnlineOrdering || cart.size === 0) {
        navigate('/');
        return;
    }

    return (
        <div className="card" id="order-checkout">
            <div className="title">
                Online Ordering Checkout
            </div>
            <div className="body flex-col">
                { cart.size > 1 && <MultiCafeOrderWarning/> }
                <CartContentsTable/>
            </div>
        </div>
    );
};