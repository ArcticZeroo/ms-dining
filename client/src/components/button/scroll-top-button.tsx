import React, { useCallback, useEffect, useState } from 'react';
import { classNames } from '../../util/react.ts';

import './scroll-top-button.css';

export interface IScrollTopButtonProps {
    containerRef: React.RefObject<HTMLElement>;
}

export const ScrollTopButton: React.FC<IScrollTopButtonProps> = ({ containerRef }) => {
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

        container.addEventListener('scroll', onScroll);
        onScroll();

        return () => {
            container.removeEventListener('scroll', onScroll);
        };
    }, [containerRef, onScroll]);

    const onScrollTopClicked = () => {
        if (isNearTop) {
            return;
        }

        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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