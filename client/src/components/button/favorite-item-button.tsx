import React from 'react';
import { StringSetSetting } from '../../api/settings.ts';
import filledStarIcon from '../../assets/icons/filled/star.svg';
import outlinedStarIcon from '../../assets/icons/outline/star.svg';
import { useValueNotifierSetTarget } from '../../hooks/events.ts';
import { classNames } from '../../util/react.ts';

import './favorite-item-button.css';

interface IFavoriteItemButtonProps {
    name: string;
    setting: StringSetSetting;
    isDisabled?: boolean;
}

export const FavoriteItemButton: React.FC<IFavoriteItemButtonProps> = ({ name, setting, isDisabled }) => {
    const isItemFavorite = useValueNotifierSetTarget(setting, name);

    const onFavoriteClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (isDisabled) {
            return;
        }

        if (isItemFavorite) {
            setting.delete(name);
        } else {
            setting.add(name);
        }
    };

    return (
        <button
            className={classNames('favorite-item-button icon-container', isItemFavorite && 'is-favorite', isDisabled && 'disabled')}
            title={isItemFavorite ? 'Click to remove from favorites' : 'Favorite this item'}
            onClick={onFavoriteClicked}
        >
            <img
                src={outlinedStarIcon}
                alt="not favorite"
                className="icon-sized"
            />
            <img
                src={filledStarIcon}
                alt="favorite"
                className="favorite-enabled icon-sized"
                style={{ opacity: isItemFavorite ? '1' : '0' }}
            />
        </button>
    );
};