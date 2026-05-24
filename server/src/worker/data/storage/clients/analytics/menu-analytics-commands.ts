import type { IMenuAnalyticsService } from '../../../../../shared/services/menu-analytics.js';
import type { ICafeStation } from '../../../../../shared/models/cafe.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { retrieveUniquenessDataForCafe } from '../../../cache/daily-uniqueness.js';
import { resolveIngredientsMenuAsync } from '../../../cache/ingredients-menu.js';
import { getShutdownCafeStateAsync } from '../../../cache/daily-cafe-state.js';
import { retrieveVisitData } from '../../../cache/pattern.js';

const mapToRecord = <T>(map: ReadonlyMap<string, T>): Record<string, T> =>
    Object.fromEntries(map);

export const menuAnalyticsServiceCommands = {
    retrieveUniquenessDataForCafe: async ({ cafeId, targetDateString, forceUpdate }: { cafeId: string; targetDateString: string; forceUpdate?: boolean }) =>
        mapToRecord(await retrieveUniquenessDataForCafe(cafeId, targetDateString, forceUpdate)),
    resolveIngredientsMenu: async ({ cafeId, dateString, menuStations }: { cafeId: string; dateString: string; menuStations: ICafeStation[] }) =>
        resolveIngredientsMenuAsync(cafeId, dateString, menuStations),
    getShutdownCafeState: async ({ dateString }: { dateString: string }) =>
        getShutdownCafeStateAsync(dateString),
    retrieveVisitData: async ({ entityType, name }: { entityType: SearchEntityType; name: string }) =>
        retrieveVisitData(entityType, name),
} satisfies IMenuAnalyticsService;
