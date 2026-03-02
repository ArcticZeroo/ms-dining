import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SearchEntityType } from '@msdining/common/models/search';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../api/client/dining.ts';
import { ApplicationContext } from '../context/app.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { useDebouncedValue } from './debounce.ts';
import { useValueNotifier } from './events.ts';
import { getLocalCafeSuggestions, buildNormalizedCafeViews } from '../util/autocomplete.ts';

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

    const localCafeSuggestions = useMemo(
        () => getLocalCafeSuggestions(localDebouncedQuery, normalizedCafeViews),
        [localDebouncedQuery, normalizedCafeViews]
    );

    const fetchServerSuggestions = useCallback(async () => {
        if (serverDebouncedQuery.length === 0) {
            return [];
        }
        const results = await DiningClient.retrieveAutocompleteSuggestions(serverDebouncedQuery);
        return results.filter(result => result.entityType !== SearchEntityType.cafe);
    }, [serverDebouncedQuery]);

    // If there's an error we intentionally show nothing for now.
    // eslint-disable-next-line msdining/require-promise-state-stage
    const { value: serverSuggestions } = useImmediatePromiseState(fetchServerSuggestions);

    const [isSuppressed, setIsSuppressed] = useState(false);

    useEffect(() => {
        setIsSuppressed(false);
    }, [localDebouncedQuery]);

    const suggestions = useMemo(
        () => isSuppressed ? [] : [...localCafeSuggestions, ...(serverSuggestions ?? [])],
        [localCafeSuggestions, serverSuggestions, isSuppressed]
    );

    const clearSuggestions = useCallback(() => {
        setIsSuppressed(true);
    }, []);

    return { suggestions, clearSuggestions };
};
