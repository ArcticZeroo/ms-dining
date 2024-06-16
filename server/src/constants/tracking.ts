const primary = 'msdining';

export const getApplicationNameForScenario = (scenario: string) => `${primary}-${scenario}`;

export const getApplicationNameForCafeMenu = (cafeId: string) => getApplicationNameForScenario(`${cafeId}-menu`);
export const getApplicationNameForMenuOverview = (cafeId: string) => getApplicationNameForScenario(`${cafeId}-overview`);

export const ANALYTICS_APPLICATION_NAMES = {
	primary,
	poster:          getApplicationNameForScenario('poster'),
	search:          getApplicationNameForScenario('search'),
	searchExplore:   getApplicationNameForScenario('search-explore'),
	searchFavorites: getApplicationNameForScenario('search-favorites'),
	cheapItems:      getApplicationNameForScenario('cheap-items')
};