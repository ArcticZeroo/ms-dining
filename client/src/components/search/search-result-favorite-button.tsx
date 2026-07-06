import { SearchTypes } from '@msdining/common';
import React from 'react';
import { CafeView } from '../../models/cafe.ts';
import { FavoriteCafeSearchResultButton } from '../button/favorite/favorite-cafe-search-result-button.tsx';
import { FavoriteSearchableItemButton } from '../button/favorite/favorite-searchable-item-button.tsx';

interface ISearchResultFavoriteButtonProps {
    entityType: SearchTypes.SearchEntityType;
    entityView?: CafeView;
    name: string;
    showFavoriteButton: boolean;
}

export const SearchResultFavoriteButton: React.FC<ISearchResultFavoriteButtonProps> = ({
    entityType,
    entityView,
    name,
    showFavoriteButton,
}) => {
    if (entityView) {
        return (
            <FavoriteCafeSearchResultButton view={entityView}/>
        );
    }

    if (!showFavoriteButton) {
        return null;
    }

    return (
        <div>
            <FavoriteSearchableItemButton
                name={name}
                type={entityType}
            />
        </div>
    );
};
