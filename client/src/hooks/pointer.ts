import { RefObject, useEffect } from 'react';

export const useClickTracker = (ref: RefObject<Element | null>, onClick: (isInside: boolean, event: MouseEvent) => void, enabled: boolean = true) => {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handler = (event: MouseEvent) => {
            const isInside = ref.current != null && ref.current.contains(event.target as Node);
            onClick(isInside, event);
        };

        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [ref, onClick, enabled]);
};
