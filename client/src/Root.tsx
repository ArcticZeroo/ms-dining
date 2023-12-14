import { PopupContainer } from './components/popup/popup-container.tsx';
import { Nav } from './components/nav/nav.tsx';
import { classNames } from './util/react.ts';
import { Outlet } from 'react-router-dom';
import { CartPopup } from './components/dining-halls/station/menu-items/order/cart/cart-popup.tsx';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { NavExpansionContext } from './context/nav.ts';
import { useValueNotifier, useValueNotifierContext } from './hooks/events.ts';
import { ValueNotifier } from './util/events.ts';
import { CafeView } from './models/cafe.ts';
import { useContext, useEffect, useRef } from 'react';
import { SelectedViewContext } from './context/view.ts';
import { PopupContext } from './context/modal.ts';

const useMenuScrollTopRef = (selectedViewNotifier: ValueNotifier<CafeView | undefined>) => {
    const selectedView = useValueNotifier(selectedViewNotifier);
    const menuDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (menuDivRef.current) {
            menuDivRef.current.scrollTop = 0;
        }
    }, [selectedView]);

    return menuDivRef;
};

export const Root = () => {
    const [isNavExpanded] = useContext(NavExpansionContext);
    const deviceType = useDeviceType();

    const selectedViewNotifier = useContext(SelectedViewContext);
    const currentModal = useValueNotifierContext(PopupContext);

    const menuDivRef = useMenuScrollTopRef(selectedViewNotifier);

    const shouldStopScroll = (isNavExpanded && deviceType === DeviceType.Mobile) || currentModal != null;


    return (
        <>
            <PopupContainer/>
            <Nav/>
            <div className={classNames('content', shouldStopScroll && 'noscroll')}
                 ref={menuDivRef}>
                <Outlet/>
            </div>
            <CartPopup/>
        </>
    );
};