import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React, { useMemo } from 'react';
import filledStarIcon from '../../assets/icons/filled/star.svg';
import { useValueNotifierSetTarget } from '../../hooks/events.ts';
import { getTargetSettingForFavorite } from '../../util/cafe.ts';
import { classNames } from '../../util/react.ts';

import './favorite-item-button.css';

interface IFavoriteItemButtonProps {
    name: string;
    type: SearchEntityType;
    isDisabled?: boolean;
}

export const FavoriteItemButton: React.FC<IFavoriteItemButtonProps> = ({ name, type, isDisabled = false }) => {
    const targetSetting = getTargetSettingForFavorite(type);

    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(name),
        [name]
    );

    const isItemFavorite = useValueNotifierSetTarget(targetSetting, normalizedItemName);

    const onFavoriteClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (isDisabled) {
            return;
        }

        if (isItemFavorite) {
            targetSetting.delete(normalizedItemName);
        } else {
            targetSetting.add(normalizedItemName);
        }
    };

    return (
        <button
            className={classNames('favorite-item-button', isItemFavorite && 'is-favorite', isDisabled && 'disabled')}
            title={isItemFavorite ? 'Click to remove from favorites' : 'Favorite this item'}
            onClick={onFavoriteClicked}
        >
            <img src={filledStarIcon} alt="favorite" className="favorite-enabled icon-sized" style={{ display: isItemFavorite ? 'block' : 'none' }}/>
            <span className="material-symbols-outlined" style={{ display: isItemFavorite ? 'none' : 'block' }}>
                star
            </span>
        </button>
    )
}