import {
	ANALYTICS_APPLICATION_NAMES,
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverview
} from '@msdining/common/dist/constants/analytics.js';
import { createAnalyticsApplicationAsync } from './visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { logError, logInfo } from '../../util/log.js';
import { ENVIRONMENT_SETTINGS } from '../../util/env.js';
import { ALL_CAFES } from '../../constants/cafes.js';

const getAllApplicationNames = () => {
	const names = new Set(Object.values(ANALYTICS_APPLICATION_NAMES));

	for (const cafe of ALL_CAFES) {
		names.add(getApplicationNameForCafeMenu(cafe.id));
		names.add(getApplicationNameForMenuOverview(cafe.id));
	}

	return names;
}

export const createAnalyticsApplications = async () => {
	const failedApplicationNames = new Set<string>();

	for (const name of getAllApplicationNames()) {
		try {
			// The analytics service runs SQL sequentially anyway, don't need to do this in parallel
			await createAnalyticsApplicationAsync(name);
			ApplicationContext.analyticsApplicationsReady.add(name);
		} catch (err) {
			if (!ENVIRONMENT_SETTINGS.ignoreAnalyticsFailures) {
				// Only log the first. If one is broken it's likely that they all are, and we don't want to spam.
				if (failedApplicationNames.size === 0) {
					logError(`Failed to create application for ${name}:`, err);
				}
			}

			failedApplicationNames.add(name);
		}
	}

	if (ApplicationContext.analyticsApplicationsReady.size > 0) {
		logInfo(`Created ${ApplicationContext.analyticsApplicationsReady.size} analytics applications`);
	}

	if (!ENVIRONMENT_SETTINGS.ignoreAnalyticsFailures && failedApplicationNames.size > 0) {
		logError(`Failed to create ${failedApplicationNames.size} analytics applications`);
	}
}