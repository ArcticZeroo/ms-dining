import { ICafe } from "../models/cafe.ts";
import {
    getScenarioForCafeMenu,
    getScenarioForMenuOverview,
    SCENARIO_NAMES
} from "@msdining/common/dist/constants/analytics";

export interface IScenario {
    label: string;
    scenarioName?: string;
}

export const STATIC_SCENARIOS: IScenario[] = [
    {
        label: 'All Traffic'
    },
    {
        label: 'Poster QR Code',
        scenarioName: SCENARIO_NAMES.poster
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
    }
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
