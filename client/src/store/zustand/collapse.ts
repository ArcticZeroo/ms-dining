import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

interface ICollapseStore {
    ids: Set<string>;
    add(id: string): void;
    delete(id: string): void;
    clear(): void;
}

const createCollapseStore = () =>
    create<ICollapseStore>()(
        mutative((set) => ({
            ids:    new Set(),
            add:    (id) => set((state) => {
                state.ids.add(id);
            }),
            delete: (id) => set((state) => {
                state.ids.delete(id);
            }),
            clear:  () => set((state) => {
                state.ids.clear();
            }),
        }))
    );

export const useCollapsedCafeIdsStore = createCollapseStore();
export const useCollapsedStationIdsStore = createCollapseStore();

/**
 * Returns whether `id` is in the given collapse set. Selecting on the boolean
 * (rather than the whole set) means components only re-render when their own
 * membership changes, not when an unrelated id is added or removed.
 */
const useIsCollapsed = (
    store: typeof useCollapsedCafeIdsStore,
    id: string
): boolean => store((state) => state.ids.has(id));

export const useIsCafeCollapsed = (cafeId: string) =>
    useIsCollapsed(useCollapsedCafeIdsStore, cafeId);

export const useIsStationCollapsed = (stationId: string) =>
    useIsCollapsed(useCollapsedStationIdsStore, stationId);

// Non-hook write helpers. The store hook itself is exported above for callers
// that need access to multiple actions.
export const collapseCafe = (cafeId: string) => useCollapsedCafeIdsStore.getState().add(cafeId);
export const expandCafe = (cafeId: string) => useCollapsedCafeIdsStore.getState().delete(cafeId);
export const collapseStation = (stationId: string) => useCollapsedStationIdsStore.getState().add(stationId);
export const expandStation = (stationId: string) => useCollapsedStationIdsStore.getState().delete(stationId);
