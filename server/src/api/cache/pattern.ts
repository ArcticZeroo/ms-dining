import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { IEntityVisitData } from '@msdining/common/dist/models/pattern.js';
import { ExpiringCacheMap } from './expiring-cache.js';
import Duration from '@arcticzeroo/duration';
import { DailyMenuStorageClient } from '../storage/clients/daily-menu.js';
import { calculatePattern, IPatternData } from '@msdining/common/dist/util/pattern-util.js';

const VISIT_DATA_CACHE = new Map<SearchEntityType, ExpiringCacheMap<string /*id*/, Array<IEntityVisitData>>>();

export const retrieveVisitData = (entityType: SearchEntityType, id: string): Promise<Array<IEntityVisitData>> => {
	if (!VISIT_DATA_CACHE.has(entityType)) {
		VISIT_DATA_CACHE.set(entityType, new ExpiringCacheMap(
			new Duration({ minutes: 5 }),
			async id => DailyMenuStorageClient.retrieveEntityVisits(
				entityType,
				id
			)
		));
	}

	return VISIT_DATA_CACHE.get(entityType)!.get(id);
}

export const retrievePatternsByCafeId = async (entityType: SearchEntityType, id: string) => {
	const visits = await retrieveVisitData(entityType, id);
	const visitsByCafeId = new Map<string /*cafeId*/, Array<string> /*dateStrings*/>();

	for (const { cafeId, dateString } of visits) {
		if (!visitsByCafeId.has(cafeId)) {
			visitsByCafeId.set(cafeId, []);
		}

		visitsByCafeId.get(cafeId)!.push(dateString);
	}

	const patternsByCafeId = new Map<string /*cafeId*/, IPatternData>();
	for (const [cafeId, dateStrings] of visitsByCafeId.entries()) {
		const pattern = calculatePattern(dateStrings);
		patternsByCafeId.set(cafeId, pattern);
	}

	return patternsByCafeId;
}