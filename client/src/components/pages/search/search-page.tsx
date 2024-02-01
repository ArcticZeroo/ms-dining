import { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchQueryContext } from '../../../context/search.ts';
import { SearchPageWithQuery } from './search-page-with-query.tsx';
import { setPageData } from '../../../util/title.ts';

export const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const searchQueryNotifier = useContext(SearchQueryContext);

    const query = searchParams.get('q');

    useEffect(() => {
        if (query == null) {
            return;
        }

        searchQueryNotifier.value = query;
    }, [searchQueryNotifier, query]);

    useEffect(() => {
        setPageData(`Search for "${query}"`, `Search results for menu items and stations across Microsoft Redmond Campus for "${query}"`);
    }, [query]);

    if (query == null) {
        return (
            <div className="error-card">
                No search query provided!
            </div>
        );
    }

    return (
        <SearchPageWithQuery queryText={query}/>
    );
};