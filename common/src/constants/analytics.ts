const primary = 'msdining';

export const getApplicationNameForScenario = (scenario: string) => `${primary}-${scenario}`;

export const getScenarioForCafeMenu = (cafeId: string) => `${cafeId}-menu`;
export const getScenarioForMenuOverview = (cafeId: string) => `${cafeId}-overview`;

export const getApplicationNameForCafeMenu = (cafeId: string) => getApplicationNameForScenario(getScenarioForCafeMenu(cafeId));
export const getApplicationNameForMenuOverview = (cafeId: string) => getApplicationNameForScenario(getScenarioForMenuOverview(cafeId));

export const SCENARIO_NAMES = {
	poster:          'poster',
	search:          'search',
	searchExplore:   'search-explore',
	searchFavorites: 'search-favorites',
	cheapItems:      'cheap-items'
};

export const ANALYTICS_APPLICATION_NAMES = {
	primary,
	poster:          getApplicationNameForScenario(SCENARIO_NAMES.poster),
	search:          getApplicationNameForScenario(SCENARIO_NAMES.search),
	searchExplore:   getApplicationNameForScenario(SCENARIO_NAMES.searchExplore),
	searchFavorites: getApplicationNameForScenario(SCENARIO_NAMES.searchFavorites),
	cheapItems:      getApplicationNameForScenario(SCENARIO_NAMES.cheapItems),
};