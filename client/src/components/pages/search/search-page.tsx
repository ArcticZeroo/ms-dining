import { useSearchParams } from 'react-router-dom';
import { ErrorCard } from '../../card/error.tsx';
import { SearchPageWithQuery } from './search-page-with-query.tsx';

export const SearchPage = () => {
    const [searchParams] = useSearchParams();

    const query = searchParams.get('q');
    if (query == null) {
        return (
            <ErrorCard>
                No search query provided!
            </ErrorCard>
        );
    }

    return (
        <SearchPageWithQuery queryText={query}/>
    );
};