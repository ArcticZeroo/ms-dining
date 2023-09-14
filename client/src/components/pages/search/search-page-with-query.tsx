import React from 'react';

interface ISearchPageWithQueryProps {
    queryText: string;
}

export const SearchPageWithQuery: React.FC<ISearchPageWithQueryProps> = ({ queryText }) => {
    return (
        <div>
            <h1>Search Results for "{queryText}"</h1>
        </div>
    );
}