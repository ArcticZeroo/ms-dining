import { useValueNotifier } from '../../../../hooks/events.ts';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { HomeFavoritesView } from './home-favorites-view.tsx';

export const HomeFavorites = () => {
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    if (favoriteItemNames.size === 0) {
        return null;
    }

    return (
        <HomeFavoritesView names={favoriteItemNames}/>
    );
};