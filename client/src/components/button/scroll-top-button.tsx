import React, { useCallback, useEffect, useState } from 'react';

import './scroll-top-button.css';
import { classNames } from '../../util/react.ts';
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';

export interface IScrollTopButtonProps {
    containerRef: React.RefObject<HTMLElement>;
}

export const ScrollTopButton: React.FC<IScrollTopButtonProps> = ({ containerRef }) => {
    const deviceType = useDeviceType();
    const [isNearTop, setIsNearTop] = useState(true);

    const onScroll = useCallback(() => {
        if (!containerRef.current) {
            return;
        }

        const container = containerRef.current;
        const scrollPosition = container.scrollTop + document.documentElement.scrollTop;

        setIsNearTop(scrollPosition < 200);
    }, [containerRef]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const eventTarget = deviceType === DeviceType.Desktop
            ? container
            : window;

        eventTarget.addEventListener('scroll', onScroll);
        onScroll();

        return () => {
            eventTarget.removeEventListener('scroll', onScroll);
        };
    }, [deviceType, containerRef, onScroll]);

    const onScrollTopClicked = () => {
        if (isNearTop) {
            return;
        }

        const targetElement = deviceType === DeviceType.Desktop
            ? containerRef.current
            : document.documentElement;

        targetElement?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return (
        <button
            id="scroll-top"
            className={classNames(!isNearTop && 'visible')}
            aria-hidden={isNearTop}
            title="Scroll to top"
            type="button"
            onClick={onScrollTopClicked}>
            <span className="material-symbols-outlined">
                arrow_upward
            </span>
        </button>
    );
}