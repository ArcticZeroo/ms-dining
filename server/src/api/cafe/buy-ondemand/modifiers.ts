import { ICafeMenuItemDetailsResponse } from '../../../models/buyondemand/responses.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { IMenuItemModifier, ModifierChoices, ModifierChoiceType } from '@msdining/common/dist/models/cafe.js';
import { BuyOnDemandClient } from './buy-ondemand-client.js';

const mapModifierChoiceType = (jsonChoiceType: string): ModifierChoiceType => {
	switch (jsonChoiceType) {
		case 'radio':
			return ModifierChoices.radio;
		case 'checkbox':
			return ModifierChoices.checkbox;
		default:
			return ModifierChoices.multiSelect;
	}
}

const mapModifiersFromDetails = (jsonItem: ICafeMenuItemDetailsResponse): Array<IMenuItemModifier> => {
	const modifiers = jsonItem.modifiers?.modifiers?.map(jsonModifier => ({
		id:          jsonModifier.id,
		description: jsonModifier.description,
		minimum:     jsonModifier.minimum,
		maximum:     jsonModifier.maximum,
		choiceType:  mapModifierChoiceType(jsonModifier.type),
		choices:     jsonModifier.options.map(jsonOption => ({
			id:          jsonOption.id,
			description: jsonOption.description,
			price:       Number(jsonOption.amount || 0)
		}))
	}));

	return modifiers ?? [];
}

export const retrieveModifiersForMenuItemAsync = async (client: BuyOnDemandClient, itemId: string): Promise<Array<IMenuItemModifier>> => {
	const response = await client.requestAsync(`/sites/${client.config.tenantId}/${client.config.contextId}/kiosk-items/${itemId}`, {
		method: 'POST',
		body:   JSON.stringify({
			show86edModifiers: false,
			useIgPosApi:       false
		})
	});

	if (!response.ok) {
		throw new Error(`Unable to retrieve modifier details for item ${itemId}: ${response.status}`);
	}

	const json = await response.json();

	// Empty object just checks that it is an object, which is good enough for our purposes.
	// We do null checks anyway later.
	if (!isDuckType<ICafeMenuItemDetailsResponse>(json, {})) {
		throw new Error('Error in processing modifier details response: Invalid object type');
	}

	if (json.modifiers?.modifiers == null) {
		return [];
	}

	return mapModifiersFromDetails(json);
}