import { IQuerySearchResult } from '../../../../models/search.ts';
import React from 'react';
import { SearchResult } from '../../../search/search-result.tsx';
import { SearchEntityType } from '@msdining/common/dist/models/search';

interface IHomeFavoriteResultProps {
    result: IQuerySearchResult;
}

export const HomeFavoriteResult: React.FC<IHomeFavoriteResultProps> = ({ result }) => {
    return (
        <SearchResult
            isVisible={true}
            name={result.name}
            locationDatesByCafeId={result.locationDatesByCafeId}
            imageUrl={result.imageUrl}
            entityType={SearchEntityType.menuItem}
        />
    );
};