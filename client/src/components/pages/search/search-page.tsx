import { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchQueryContext } from '../../../context/search.ts';
import { SearchPageWithQuery } from './search-page-with-query.tsx';

export const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const searchQueryNotifier = useContext(SearchQueryContext);

    const query = searchParams.get('q');
    if (query == null) {
        return (
            <div className="error-card">
                No search query provided!
            </div>
        );
    }

    useEffect(() => {
        searchQueryNotifier.value = query;
    }, [query]);

    return (
        <SearchPageWithQuery queryText={query}/>
    );
};