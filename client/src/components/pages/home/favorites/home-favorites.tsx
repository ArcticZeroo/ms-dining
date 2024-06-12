import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useFavoriteQueries } from '../../../../hooks/cafe.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { HomeFavoritesView } from './home-favorites-view.tsx';

export const HomeFavorites = () => {
    const shouldShowFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const favoriteQueries = useFavoriteQueries();

    if (!shouldShowFavorites) {
        return null;
    }

    if (favoriteQueries.length === 0) {
        return null;
    }

    return (
        <HomeFavoritesView queries={favoriteQueries}/>
    );
};