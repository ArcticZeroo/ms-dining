import { useSearchParams } from 'react-router-dom';
import { SearchPageWithQuery } from './search-page-with-query.tsx';

export const SearchPage = () => {
    const [searchParams] = useSearchParams();

    const query = searchParams.get('q');
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