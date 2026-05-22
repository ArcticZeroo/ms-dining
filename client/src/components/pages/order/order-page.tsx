import { Outlet } from 'react-router-dom';
import { useOnlineOrderingState } from '../../../hooks/cafe.ts';
import { OnlineOrderingUnavailableNotice } from '../../notice/online-ordering-unavailable-notice.tsx';

import './order-page.css';

export const OrderPageLayout = () => {
    const orderingState = useOnlineOrderingState();

    if (!orderingState.allowed) {
        return <OnlineOrderingUnavailableNotice state={orderingState}/>;
    }

    return <Outlet/>;
};
