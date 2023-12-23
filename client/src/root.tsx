import { PopupContainer } from './components/popup/popup-container.tsx';
import { Nav } from './components/nav/nav.tsx';
import { classNames } from './util/react.ts';
import { Outlet } from 'react-router-dom';
import { CartPopup } from './components/cafes/station/menu-items/popup/cart/cart-popup.tsx';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { NavExpansionContext } from './context/nav.ts';
import { useValueNotifier, useValueNotifierContext } from './hooks/events.ts';
import { ValueNotifier } from './util/events.ts';
import { CafeView } from './models/cafe.ts';
import React, { useContext, useEffect, useRef } from 'react';
import { SelectedViewContext } from './context/view.ts';
import { PopupContext } from './context/modal.ts';

const useScrollSaver = (scrollTopRef: React.MutableRefObject<number | undefined>, shouldStopScroll: boolean) => {
    // This is a hack to let us figure out state changes before React is aware of them
    // The problem is that we want to save/restore state in two different places:
    // 1. When the user opens the nav, we want to save the scroll position BEFORE we've notified the DOM to stop scrolling
    // 2. When the user closes the nav, we want to restore the scroll position AFTER we've notified the DOM to resume scrolling
    // useEffect will always run late, so it can't be used to save state before we notify the DOM to stop scrolling
    const lastShouldStopScroll = useRef(false);
    // We are about to tell the DOM to stop scroll - save the status beforehand
    if (shouldStopScroll && lastShouldStopScroll.current !== shouldStopScroll) {
        scrollTopRef.current = document.documentElement.scrollTop;
    }
    lastShouldStopScroll.current = shouldStopScroll;

    useEffect(() => {
        if (!shouldStopScroll && scrollTopRef.current != null) {
            document.documentElement.scrollTop = scrollTopRef.current;
        }
    }, [shouldStopScroll, scrollTopRef]);
}

const useScrollTopRef = (selectedViewNotifier: ValueNotifier<CafeView | undefined>, shouldStopScroll: boolean) => {
    const selectedView = useValueNotifier(selectedViewNotifier);
    const pageBodyDivRef = useRef<HTMLDivElement>(null);
    const scrollTopRef = useRef<number | undefined>(undefined);

    useScrollSaver(scrollTopRef, shouldStopScroll);

    useEffect(() => {
        if (pageBodyDivRef.current) {
            pageBodyDivRef.current.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        }
    }, [selectedView]);


    return pageBodyDivRef;
};

export const Root = () => {
    const [isNavExpanded] = useContext(NavExpansionContext);
    const deviceType = useDeviceType();

    const selectedViewNotifier = useContext(SelectedViewContext);
    const currentModal = useValueNotifierContext(PopupContext);

    const shouldStopScroll = (isNavExpanded && deviceType === DeviceType.Mobile) || currentModal != null;

    const pageBodyDivRef = useScrollTopRef(selectedViewNotifier, shouldStopScroll);

    console.log('rendering with shouldStopScroll:', shouldStopScroll);

    return (
        <>
            <PopupContainer/>
            <Nav/>
            <div className={classNames('content', shouldStopScroll && 'noscroll')}
                 ref={pageBodyDivRef}>
                <Outlet/>
            </div>
            <CartPopup/>
        </>
    );
};