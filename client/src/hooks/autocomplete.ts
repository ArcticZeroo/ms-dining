import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { useAutocompleteSuggestionsQuery } from '../store/queries/search.ts';
import { useDebouncedValue } from './debounce.ts';
import { useValueNotifier } from './events.ts';
import { buildNormalizedCafeViews, getLocalSuggestions } from '../util/autocomplete.ts';

const AUTOCOMPLETE_DEBOUNCE_MS = 200;
const LOCAL_DEBOUNCE_MS = 50;

export const useAutocompleteSuggestions = (query: string) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const localDebouncedQuery = useDebouncedValue(query.trim(), LOCAL_DEBOUNCE_MS);
    const serverDebouncedQuery = useDebouncedValue(query.trim(), AUTOCOMPLETE_DEBOUNCE_MS);

    const normalizedCafeViews = useMemo(
        () => buildNormalizedCafeViews(viewsById, shouldUseGroups),
        [viewsById, shouldUseGroups]
    );

    const localSuggestions = useMemo(
        () => getLocalSuggestions(localDebouncedQuery, normalizedCafeViews),
        [localDebouncedQuery, normalizedCafeViews]
    );

    // Server suggestions intentionally render nothing on error.
    const { data: serverSuggestions } = useAutocompleteSuggestionsQuery(serverDebouncedQuery);

    const [isSuppressed, setIsSuppressed] = useState(false);

    useEffect(() => {
        setIsSuppressed(false);
    }, [localDebouncedQuery]);

    const suggestions = useMemo(
        () => isSuppressed ? [] : [...localSuggestions, ...(serverSuggestions ?? [])],
        [localSuggestions, serverSuggestions, isSuppressed]
    );

    const clearSuggestions = useCallback(() => {
        setIsSuppressed(true);
    }, []);

    const showSuggestions = useCallback(() => {
        setIsSuppressed(false);
    }, []);

    return { suggestions, clearSuggestions, showSuggestions };
};
