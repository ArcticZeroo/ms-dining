import { Outlet } from 'react-router-dom';
import { useOnlineOrderingStatus } from '../../../hooks/cafe.ts';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';

import './order-page.css';

export const OrderPageLayout = () => {
    const orderingState = useOnlineOrderingStatus();
    if (!orderingState.allowed) {
        return <OnlineOrderingUnavailableNotice state={orderingState}/>;
    }

    return <Outlet/>;
};
