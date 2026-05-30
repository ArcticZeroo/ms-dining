/**
 * Station/concept handlers: station list, concept schedule, and tag definitions.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

/**
 * Shape of a station fixture entry — mirrors ICafeStationListItem from responses.ts.
 */
interface StationFixture {
    id: string;
    name: string;
    image?: string;
    priceLevelConfig: { menuId: string };
    menus: Array<{
        id: string;
        name: string;
        categories: Array<{
            categoryId: string;
            name: string;
            items: string[];
            subCategories?: Array<{
                subCategoryId: string;
                name: string;
                items: string[];
            }>;
        }>;
        lastUpdateTime: string;
    }>;
    conceptOptions?: Record<string, string>;
    availableAt?: { open: string; close: string };
    // Ordering-specific fields
    schedule?: unknown[];
    openScheduleExpression?: string;
    closeScheduleExpression?: string;
}

interface TagsFixture {
    [stationId: string]: {
        customLabels: {
            [labelId: string]: {
                tagId: string;
                tagName: string;
                imageName?: string;
            };
        };
    };
}

const DEFAULT_STATIONS: StationFixture[] = [
    {
        id: 'station-1',
        name: 'Default Station',
        priceLevelConfig: { menuId: 'menu-1' },
        menus: [
            {
                id: 'menu-1',
                name: 'Main Menu',
                categories: [
                    {
                        categoryId: 'cat-1',
                        name: 'Entrees',
                        items: ['item-1', 'item-2'],
                    },
                    {
                        categoryId: 'cat-2',
                        name: 'Beverages',
                        items: ['item-3'],
                    },
                ],
                lastUpdateTime: new Date().toISOString(),
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
        schedule: [
            {
                scheduledExpression: '0 0 0 * * *',
                displayProfileState: {
                    conceptStates: [{ conceptId: 'station-1', menuId: 'menu-1' }],
                },
            },
        ],
        openScheduleExpression: '0 0 7 * * *',
        closeScheduleExpression: '0 0 15 * * *',
    },
];

/**
 * POST /sites/:tenantId/:contextId/concepts/:displayProfileId
 * Returns station list (concept list) for a cafe.
 */
function handleConceptList(req: TestRequest, state: ITestServerState): TestResponse {
    const stations = state.getFixture<StationFixture[]>(req.cafeId, 'stations') ?? DEFAULT_STATIONS;

    // Check if cafe is marked as unavailable
    const unavailable = state.getFixture<boolean>(req.cafeId, 'unavailable');
    if (unavailable) {
        return { status: 410, statusText: 'Gone' };
    }

    return {
        status: 200,
        body: stations,
    };
}

/**
 * POST /sites/:tenantId/:contextId/concepts/:displayProfileId/menus/:stationId
 * Returns tag definitions for a station.
 */
function handleStationTags(req: TestRequest, state: ITestServerState): TestResponse {
    const stationId = req.params?.stationId;

    const allTags = state.getFixture<TagsFixture>(req.cafeId, 'tags') ?? {};
    const stationTags = allTags[stationId!] ?? { customLabels: {} };

    return {
        status: 200,
        body: [stationTags],
    };
}

export const stationRoutes: RouteDefinition[] = [
    {
        method: 'POST',
        pattern: '/sites/:tenantId/:contextId/concepts/:displayProfileId',
        handler: handleConceptList,
    },
    {
        method: 'POST',
        pattern: '/sites/:tenantId/:contextId/concepts/:displayProfileId/menus/:stationId',
        handler: handleStationTags,
    },
];
