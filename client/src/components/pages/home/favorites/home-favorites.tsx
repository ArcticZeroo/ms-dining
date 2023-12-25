import { useFavoriteQueries } from '../../../../hooks/cafe.ts';
import { HomeFavoritesView } from './home-favorites-view.tsx';

export const HomeFavorites = () => {
	const favoriteQueries = useFavoriteQueries();

	if (favoriteQueries.length === 0) {
		return null;
	}

	return (
		<HomeFavoritesView queries={favoriteQueries}/>
	);
};