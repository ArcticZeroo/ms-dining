import React from "react";
import { useValueNotifierSetTarget } from "../../hooks/events.ts";
import { classNames } from "../../util/react.ts";
import filledStarIcon from "../../assets/icons/filled/star.svg";
import outlinedStarIcon from "../../assets/icons/outline/star.svg";
import { StringSetSetting } from "../../api/settings.ts";

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
            className={classNames('favorite-item-button', isItemFavorite && 'is-favorite', isDisabled && 'disabled')}
            title={isItemFavorite ? 'Click to remove from favorites' : 'Favorite this item'}
            onClick={onFavoriteClicked}
        >
            <img src={filledStarIcon} alt="favorite" className="favorite-enabled icon-sized" style={{ display: isItemFavorite ? 'block' : 'none' }}/>
            <img src={outlinedStarIcon} alt="not favorite" className="icon-sized" style={{ display: isItemFavorite ? 'none' : 'block' }}/>
        </button>
    )
};