import { useContext, useEffect, useMemo } from 'react';
import { CafesOnPageContext } from '../context/cafes-on-page.ts';
import { useValueNotifier } from './events.ts';

export const useCafeIdsOnPage = () => {
    // There's a type error from using useValueNotifierContext, and I don't feel like fixing it right now
    const notifier = useContext(CafesOnPageContext);
    return useValueNotifier(notifier);
}

export const useTrackThisCafeOnPage = (cafeId: string) => {
    const notifier = useContext(CafesOnPageContext);
    const idSymbol = useMemo(() => Symbol(), []);

    useEffect(
        () => {
            notifier.addCafe(cafeId, idSymbol);

            return () => {
                notifier.removeCafe(cafeId, idSymbol);
            }
        },
        [notifier, cafeId, idSymbol]
    );
}