import { useEffect, useMemo } from 'react';
import { useCafesOnPageStore } from '../store/zustand/cafes-on-page.ts';

export const useCafeIdsOnPage = () => useCafesOnPageStore((state) => state.ids);

export const useTrackThisCafeOnPage = (cafeId: string) => {
    const idSymbol = useMemo(() => Symbol(), []);

    useEffect(
        () => {
            const { addRef, removeRef } = useCafesOnPageStore.getState();
            addRef(cafeId, idSymbol);

            return () => {
                removeRef(cafeId, idSymbol);
            };
        },
        [cafeId, idSymbol]
    );
}