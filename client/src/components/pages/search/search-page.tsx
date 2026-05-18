import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setSearchQuery } from '../../../store/zustand/search-query.ts';
import { SearchPageWithQuery } from './search-page-with-query.tsx';
import { setPageData } from '../../../util/title.ts';

export const SearchPage = () => {
    const [searchParams] = useSearchParams();

    const query = searchParams.get('q');

    useEffect(() => {
        if (query == null) {
            return;
        }

        setSearchQuery(query);
    }, [query]);

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