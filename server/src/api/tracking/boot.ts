import {
	ANALYTICS_APPLICATION_NAMES,
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverview
} from '@msdining/common/dist/constants/analytics.js';
import { createAnalyticsApplicationAsync } from './visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { logError, logInfo } from '../../util/log.js';
import { ENVIRONMENT_SETTINGS } from '../../util/env.js';
import { cafeList } from '../../constants/cafes.js';

const getAllApplicationNames = () => {
	const names = new Set(Object.values(ANALYTICS_APPLICATION_NAMES));

	for (const cafe of cafeList) {
		names.add(getApplicationNameForCafeMenu(cafe.id));
		names.add(getApplicationNameForMenuOverview(cafe.id));
	}

	return names;
}

export const createAnalyticsApplications = async () => {
	for (const name of getAllApplicationNames()) {
		try {
			// The analytics service runs SQL sequentially anyway, don't need to do this in parallel
			await createAnalyticsApplicationAsync(name);
			ApplicationContext.analyticsApplicationsReady.add(name);
		} catch (err) {
			if (!ENVIRONMENT_SETTINGS.ignoreAnalyticsFailures) {
				logError(`Could not create tracking application "${name}":`, err)
			}
		}
	}

	if (ApplicationContext.analyticsApplicationsReady.size > 0) {
		logInfo(`Created ${ApplicationContext.analyticsApplicationsReady.size} tracking applications`);
	}
}