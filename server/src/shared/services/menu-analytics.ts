import type { ICafeStation } from '../models/cafe.js';
import type { IStationUniquenessData, ICafeShutdownState } from '@msdining/common/models/cafe';
import type { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import type { IEntityVisitData } from '@msdining/common/models/pattern';
import { SearchEntityType } from '@msdining/common/models/search';

export interface IMenuAnalyticsService {
    retrieveUniquenessDataForCafe(data: { cafeId: string; targetDateString: string; forceUpdate?: boolean }): Promise<Record<string, IStationUniquenessData>>;
    resolveIngredientsMenu(data: { cafeId: string; dateString: string; menuStations: ICafeStation[] }): Promise<IIngredientsMenuDTO | null>;
    getShutdownCafeState(data: { dateString: string }): Promise<Record<string, ICafeShutdownState>>;
    retrieveVisitData(data: { entityType: SearchEntityType; name: string }): Promise<IEntityVisitData[]>;
}
