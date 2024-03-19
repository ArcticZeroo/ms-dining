import { useEffect, useLayoutEffect, useState } from 'react';
import { queryForScrollAnchor, scrollIntoViewIfNeeded } from '../util/html.ts';

export const useIsElementOnScreen = (element: HTMLElement | null, options?: IntersectionObserverInit) => {
    const [isOnScreen, setIsOnScreen] = useState(false);

    useEffect(() => {
        if (!element) {
            setIsOnScreen(false);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.length !== 1) {
                return;
            }

            const entry = entries[0];
            setIsOnScreen(entry.isIntersecting);
        }, options);

        observer.observe(element);

        return () => observer.disconnect();
    }, [element]);

    return isOnScreen;
}

export const useElementHeight = (headerElement: HTMLDivElement | null) => {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (!headerElement) {
            setHeight(0);
            return;
        }

        const updateHeight = () => {
            setHeight(headerElement.clientHeight);
        }

        const observer = new ResizeObserver(updateHeight);
        observer.observe(headerElement);

        updateHeight();

        return () => observer.disconnect();
    }, [headerElement]);

    return height;
}

export const useScrollIntoViewIfNeeded = (anchorId: string) => {
    const [isScrollIntoViewPending, setIsScrollIntoViewPending] = useState(false);

    useLayoutEffect(() => {
        console.log('useScrollIntoViewIfNeeded effect called');

        if (!isScrollIntoViewPending) {
            return;
        }

        console.log('scrolling', anchorId, 'into view if needed');

        scrollIntoViewIfNeeded(queryForScrollAnchor(anchorId));
        setIsScrollIntoViewPending(false);
    }, [anchorId, isScrollIntoViewPending]);
    
    return () => setIsScrollIntoViewPending(true); 
}