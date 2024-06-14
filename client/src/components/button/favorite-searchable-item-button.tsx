import React, { useMemo } from 'react';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { getTargetSettingForFavorite } from '../../util/cafe.ts';
import { FavoriteItemButton } from "./favorite-item-button.tsx";

interface IFavoriteItemButtonProps {
    name: string;
    type: SearchEntityType;
    isDisabled?: boolean;
}

export const FavoriteSearchableItemButton: React.FC<IFavoriteItemButtonProps> = ({ name, type, isDisabled = false }) => {
    const targetSetting = getTargetSettingForFavorite(type);

    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(name),
        [name]
    );

    return (
        <FavoriteItemButton
            name={normalizedItemName}
            setting={targetSetting}
            isDisabled={isDisabled}/>
    );
}