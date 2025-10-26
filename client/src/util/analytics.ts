import { ICafe } from '../models/cafe.ts';
import {
    getScenarioForCafeMenu,
    getScenarioForMenuOverview,
    SCENARIO_NAMES
} from '@msdining/common/constants/analytics';

export interface IScenario {
    label: string;
    scenarioName?: string;
}

export const STATIC_SCENARIOS: IScenario[] = [
    {
        label: 'All Traffic'
    },
    {
        label: 'User Signups',
        scenarioName: SCENARIO_NAMES.userSignup
    },
    {
        label: 'Search',
        scenarioName: SCENARIO_NAMES.search
    },
    {
        label: 'Search Favorites',
        scenarioName: SCENARIO_NAMES.searchFavorites
    },
    {
        label: 'Search Explore',
        scenarioName: SCENARIO_NAMES.searchExplore
    },
    {
        label: 'Cheap Items',
        scenarioName: SCENARIO_NAMES.cheapItems
    },
    {
        label: 'Visit History',
        scenarioName: SCENARIO_NAMES.pattern
    },
    {
        label: 'Post Review',
        scenarioName: SCENARIO_NAMES.postReview
    },
    {
        label: 'Get Reviews',
        scenarioName: SCENARIO_NAMES.getReviews
    },
    {
        label: 'Poster QR Code',
        scenarioName: SCENARIO_NAMES.poster
    },
];

export const getScenarios = (cafes: ICafe[]): IScenario[] => {
    const cafeScenarios: IScenario[] = [];

    for (const cafe of cafes) {
        cafeScenarios.push({
            label: `${cafe.name} Menu`,
            scenarioName: getScenarioForCafeMenu(cafe.id)
        });

        cafeScenarios.push({
            label: `${cafe.name} Overview`,
            scenarioName: getScenarioForMenuOverview(cafe.id)
        });
    }

    return [
        ...STATIC_SCENARIOS,
        ...cafeScenarios
    ];
}
