import { BuyOnDemandClient, JSON_HEADERS } from './buy-ondemand-client.js';
import { ICafeStationDetailsResponseItem } from '../../../models/buyondemand/responses.js';
import { normalizeTagName } from '../../../util/cafe.js';

interface IRetrieveTagDefinitionsOptions {
	client: BuyOnDemandClient;
	daysInFuture: number;
	stationId: string;
	menuId: string;
}

export const retrieveTagDefinitionsAsync = async ({ client, daysInFuture, stationId, menuId }: IRetrieveTagDefinitionsOptions): Promise<Map<string, string>> => {
	const response = await client.requestAsync(`/sites/${client.config.tenantId}/${client.config.contextId}/concepts/${client.config.displayProfileId}/menus/${stationId}`, {
		method:  'POST',
		headers: JSON_HEADERS,
		body:    JSON.stringify({
			menus:         [
				{
					id:         menuId,
					categories: [
						{
							kioskImages: []
						}
					]
				}
			],
			schedule:      [
				{
					// The service seems to try to find the first cron expression that starts before the schedule
					// time, so we'll just have a cron expression that always matches
					scheduledExpression: '0 0 0 * * *',
					displayProfileState: {
						conceptStates: [
							{
								conceptId: stationId,
								menuId
							}
						]
					}
				}
			],
			scheduleTime:  {
				startTime: '11:15 AM',
				endTime:   '11:30 AM'
			},
			scheduledDay:  daysInFuture, // we used to hardcode this to 0, but this probably breaks on weekends so may as well use it just in case
			show86edItems: false,
			useIgPosApi:   false
		})
	});

	if (!response.ok) {
		throw new Error(`Unable to retrieve tags for station id ${stationId}: ${response.status}`);
	}

	const json = await response.json() as Array<ICafeStationDetailsResponseItem>;

	if (json.length !== 1) {
		throw new Error('Invalid number of stations in response!');
	}

	const [station] = json;

	if (!station) {
		throw new Error('Station is missing from json!');
	}

	return new Map(
		Object.values(station.customLabels)
			.map(labelData => [labelData.tagId, normalizeTagName(labelData.tagName)])
	);
}