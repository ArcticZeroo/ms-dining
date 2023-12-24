import React, { useMemo } from 'react';
import filledStarIcon from '../../assets/star-filled.svg';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { classNames } from '../../util/react.ts';

import './favorite-item-button.css';

interface IFavoriteItemButtonProps {
    name: string;
}

export const FavoriteItemButton: React.FC<IFavoriteItemButtonProps> = ({ name }) => {
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(name),
        [name]
    );

    const isItemFavorite = useMemo(
        () => favoriteItemNames.has(normalizedItemName),
        [favoriteItemNames, normalizedItemName]
    );

    const onFavoriteClicked = () => {
        if (isItemFavorite) {
            ApplicationSettings.favoriteItemNames.delete(normalizedItemName);
        } else {
            ApplicationSettings.favoriteItemNames.add(normalizedItemName);
        }
    };

    return (
        <button
            className={classNames('favorite-item-button', isItemFavorite && 'is-favorite')}
            title={isItemFavorite ? 'Click to remove from favorites' : 'Favorite this item'}
            onClick={onFavoriteClicked}
        >
            <img src={filledStarIcon} alt="favorite" className="favorite-enabled" style={{ display: isItemFavorite ? 'block' : 'none' }}/>
            <span className="material-symbols-outlined" style={{ display: isItemFavorite ? 'none' : 'block' }}>
                star
            </span>
        </button>
    )
}