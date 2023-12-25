import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { useMemo } from 'react';
import { ApplicationSettings, StringSetSetting } from '../api/settings.ts';
import { getTargetSettingForFavorite } from '../util/cafe.ts';
import { useValueNotifier } from './events.ts';

const useQueries = (setting: StringSetSetting, type: SearchEntityType) => {
	const names = useValueNotifier(setting);
	return useMemo(() => {
		const queries: ISearchQuery[] = [];

		for (const name of names) {
			queries.push({
				text: name,
				type
			});
		}

		return queries;
	}, [names, type]);
};

export const useFavoriteQueries = () => {
	return [
		...useQueries(ApplicationSettings.favoriteItemNames, SearchEntityType.menuItem),
		...useQueries(ApplicationSettings.favoriteStationNames, SearchEntityType.station),
	];
};

export const useIsFavoriteItem = (name: string, type: SearchEntityType = SearchEntityType.menuItem) => {
	const targetSetting = getTargetSettingForFavorite(type);

	const favoriteNames = useValueNotifier(targetSetting);

	const normalizedItemName = useMemo(
		() => normalizeNameForSearch(name),
		[name]
	);

	return useMemo(
		() => favoriteNames.has(normalizedItemName),
		[normalizedItemName, favoriteNames]
	);
};