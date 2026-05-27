import { Route, Routes } from 'react-router-dom';
import { useOnlineOrderingStatus } from '../../../hooks/cafe.ts';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';
import { OrderCheckoutView } from './order-checkout-view.tsx';
import { CompletedOrdersView } from './completed-orders-view.tsx';
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
            <Route path="done" element={<CompletedOrdersView/>}/>
            <Route path="history" element={<OrderHistoryView/>}/>
        </Routes>
    );
};
