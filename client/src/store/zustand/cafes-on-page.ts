import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

interface ICafesOnPageStore {
    /**
     * The set of cafe IDs that are currently mounted somewhere on the page.
     * Derived from `refsByCafeId` — only updated when membership actually
     * changes, so consumers selecting on `ids` don't re-render when a second
     * consumer of an already-tracked cafe mounts/unmounts.
     */
    ids: Set<string>;

    /**
     * Internal ref counting via opaque symbols. Each consumer hook generates
     * its own symbol, allowing multiple components to track the same cafe
     * independently. The cafe is dropped from `ids` only when its symbol set
     * becomes empty.
     */
    refsByCafeId: Map<string, Set<symbol>>;

    addRef(cafeId: string, ref: symbol): void;
    removeRef(cafeId: string, ref: symbol): void;
}

export const useCafesOnPageStore = create<ICafesOnPageStore>()(
    mutative((set) => ({
        ids:          new Set(),
        refsByCafeId: new Map(),
        addRef:       (cafeId, ref) => set((state) => {
            let refs = state.refsByCafeId.get(cafeId);
            if (!refs) {
                refs = new Set();
                state.refsByCafeId.set(cafeId, refs);
                // Only touch state.ids when membership actually changes so that
                // selectors keyed on `state.ids` keep the same identity across
                // ref-count-only updates.
                state.ids.add(cafeId);
            }
            refs.add(ref);
        }),
        removeRef:    (cafeId, ref) => set((state) => {
            const refs = state.refsByCafeId.get(cafeId);
            if (!refs) {
                return;
            }

            refs.delete(ref);

            if (refs.size === 0) {
                state.refsByCafeId.delete(cafeId);
                state.ids.delete(cafeId);
            }
        }),
    }))
);
