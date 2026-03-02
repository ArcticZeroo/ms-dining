import { IAutocompleteSuggestion, SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { CACHE_EVENTS } from '../storage/events.js';
import { type IAutocompleteMatch, matchAutocomplete } from '@msdining/common/util/autocomplete';
import { MenuItemStorageClient } from '../storage/clients/menu-item.js';
import { StationStorageClient } from '../storage/clients/station.js';

const stationNames = new Map<string /*normalizedName*/, string /*displayName*/>();
const menuItemNames = new Map<string /*normalizedName*/, string /*displayName*/>();

const indexName = (name: string, namesMap: Map<string, string>) => {
	const normalizedName = normalizeNameForSearch(name);
	if (normalizedName.length > 0 && !namesMap.has(normalizedName)) {
		namesMap.set(normalizedName, name);
	}
}

const indexStationName = (name: string) => {
	indexName(name, stationNames);
};

const indexMenuItemName = (name: string) => {
	indexName(name, menuItemNames);
};

CACHE_EVENTS.on('menuPublished', (event) => {
	for (const station of event.menu) {
		indexStationName(station.name);

		for (const menuItem of station.menuItemsById.values()) {
			indexMenuItemName(menuItem.name);
		}
	}
});

export const seedAutocompleteFromDatabaseAsync = async () => {
	// Menu item names come from the MenuItemStorageClient cache,
	// which is already populated by retrieveMenuItemsForWeeklyMenuAsync() on boot.
	for (const name of MenuItemStorageClient.cachedMenuItemNames) {
		indexMenuItemName(name);
	}

	// Station names aren't cached elsewhere, so we do a lightweight query.
	const stations = await StationStorageClient.retrieveAllStationNamesAsync();
	for (const name of stations) {
		indexStationName(name);
	}
};

const MAX_RESULTS_PER_CATEGORY = 5;

interface IScoredSuggestion {
	suggestion: IAutocompleteSuggestion;
	match: IAutocompleteMatch;
}

const compareSuggestions = (a: IScoredSuggestion, b: IScoredSuggestion): number => {
	if (a.match.quality !== b.match.quality) {
		return a.match.quality - b.match.quality;
	}
	return a.match.distance - b.match.distance;
};

const searchEntityNames = (
	namesMap: Map<string, string>,
	entityType: SearchEntityType,
	normalizedQuery: string
): IAutocompleteSuggestion[] => {
	const matches: IScoredSuggestion[] = [];

	for (const [normalizedName, displayName] of namesMap) {
		const match = matchAutocomplete(normalizedName, normalizedQuery, displayName);
		if (match == null) {
			continue;
		}

		matches.push({
			suggestion: { entityType, name: displayName },
			match
		});
	}

	matches.sort(compareSuggestions);
	return matches.slice(0, MAX_RESULTS_PER_CATEGORY).map(scored => scored.suggestion);
};

export const searchAutocomplete = (query: string): IAutocompleteSuggestion[] => {
	const normalizedQuery = normalizeNameForSearch(query);
	if (normalizedQuery.length <= 2) {
		return [];
	}

	const stations = searchEntityNames(stationNames, SearchEntityType.station, normalizedQuery);
	const menuItems = searchEntityNames(menuItemNames, SearchEntityType.menuItem, normalizedQuery);

	return [...stations, ...menuItems];
};
