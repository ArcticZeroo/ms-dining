import React, { useContext } from 'react';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { getParentView } from '../../../util/view.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { CafeView } from '../../../models/cafe.ts';
import { FavoriteItemButton } from './favorite-item-button.tsx';

interface IFavoriteCafeSearchResultButtonProps {
    view: CafeView;
}

export const FavoriteCafeSearchResultButton: React.FC<IFavoriteCafeSearchResultButtonProps> = ({ view }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const targetView = getParentView(viewsById, view, shouldUseGroups);

    return (
        <FavoriteItemButton
            name={targetView.value.id}
            setting={ApplicationSettings.homepageViews}
        />
    );
};