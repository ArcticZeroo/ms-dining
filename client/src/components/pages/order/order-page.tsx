import { Route, Routes } from 'react-router-dom';
import { useOnlineOrderingStatus } from '../../../hooks/cafe.ts';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';
import { OrderCheckoutView } from './order-checkout-view.tsx';
import { TodayOrdersView } from './history/today-orders-view.tsx';
import { OrderHistoryView } from './history/order-history-view.tsx';

import './order-page.css';

export const OrderPageLayout = () => {
    const orderingState = useOnlineOrderingStatus();
    if (!orderingState.allowed) {
        return <OnlineOrderingUnavailableNotice state={orderingState}/>;
    }

    return (
        <Routes>
            <Route index={true} element={<OrderCheckoutView/>}/>
            <Route path="done" element={<TodayOrdersView/>}/>
            <Route path="history" element={
                <OrderHistoryView
                    title="Order History"
                    pageDescription="Browse your past dining orders."
                />
            }/>
        </Routes>
    );
};
