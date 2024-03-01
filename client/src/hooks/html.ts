import { useEffect, useState } from 'react';

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