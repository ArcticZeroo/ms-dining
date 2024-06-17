import fetch from 'node-fetch';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { logError } from '../../util/log.js';
import { ApplicationContext } from '../../constants/context.js';
import { IHourlyVisitCount } from '@msdining/common/dist/models/analytics.js';

const serverUrl = 'http://localhost:4000';

export const createAnalyticsApplicationAsync = async (applicationName: string) => {
	await fetch(`${serverUrl}/applications/${applicationName}`, {
		method: 'POST'
	});
};

export const sendVisitAsync = async (applicationName: string, visitorId: string) => {
	const response = await fetch(`${serverUrl}/applications/${applicationName}/visits/visitor/${visitorId}`, {
		method: 'PUT'
	});

	if (!response.ok && response.status !== 304) {
		throw new Error(`Failed to send visit: ${response.status}`);
	}
};

export const sendVisitFireAndForget = (applicationName: string, visitorId: string) => {
	if (!ApplicationContext.analyticsApplicationsReady.has(applicationName)) {
		return;
	}

	sendVisitAsync(applicationName, visitorId)
		.catch(err => logError(`Failed to send visit for appId: ${applicationName}, error:`, err));
}

export const getVisitsAsync = async (applicationName: string, daysAgo: number): Promise<Array<IHourlyVisitCount>> => {
	const response = await fetch(`${serverUrl}/applications/${applicationName}/visits?days=${daysAgo}`);

	if (!response.ok) {
		throw new Error(`Failed to get visits. Status: ${response.status}, text: ${await response.text()}`);
	}

	const json = await response.json();

	if (!isDuckTypeArray<IHourlyVisitCount>(json, {
		count: 'number',
		date:  'string'
	})) {
		throw new Error('Invalid response from server');
	}

	return json;
};
