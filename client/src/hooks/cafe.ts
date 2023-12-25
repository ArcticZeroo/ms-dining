import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { useMemo } from 'react';
import { ApplicationSettings } from '../api/settings.ts';
import { useValueNotifier } from './events.ts';
export const useIsFavoriteItem = (name: string) => {
	const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

	const normalizedItemName = useMemo(
		() => normalizeNameForSearch(name),
		[name]
	);

	return useMemo(
		() => favoriteItemNames.has(normalizedItemName),
		[normalizedItemName, favoriteItemNames]
	);
}