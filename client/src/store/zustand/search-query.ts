import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

interface ISearchQueryStore {
    query: string;
    setQuery(value: string): void;
}

export const useSearchQueryStore = create<ISearchQueryStore>()(
    mutative((set) => ({
        query: '',
        setQuery: (value: string) => set((state) => {
            state.query = value;
        }),
    }))
);

export const useSearchQuery = (): string => useSearchQueryStore((state) => state.query);

export const setSearchQuery = (value: string) => useSearchQueryStore.getState().setQuery(value);
