import { BuyOnDemandClient, JSON_HEADERS } from './buy-ondemand-client.js';
import { ICafeStation } from '../../../models/cafe.js';
import { ICafeMenuItemListResponseItem } from '../../../models/buyondemand/responses.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';

export const retrieveMenuItemsAsync = async (client: BuyOnDemandClient, station: ICafeStation, itemIds: string[]): Promise<Array<ICafeMenuItemListResponseItem>> => {
	const response = await client.requestAsync(`/sites/${client.config.tenantId}/${client.config.contextId}/kiosk-items/get-items`,
		{
			method:  'POST',
			headers: JSON_HEADERS,
			body:    JSON.stringify({
				conceptId:          station.id,
				currencyUnit:       'USD',
				isCategoryHasItems: true,
				menuPriceLevel:     {
					menuId: station.menuId
				},
				show86edItems:      false,
				useIgPosApi:        false,
				itemIds,
			})
		}
	);

	const json = await response.json();
	if (!isDuckTypeArray<ICafeMenuItemListResponseItem>(json, {
		id:          'string',
		amount:      'string',
		displayText: 'string',
		properties:  'object'
	})) {
		throw new Error('Cafe menu item is missing id/amount/displayText/properties');
	}

	return json;
}