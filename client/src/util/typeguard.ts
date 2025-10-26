import { isDuckType } from '@arcticzeroo/typeguard';
import { ISerializedModifier } from '@msdining/common/models/cart';
import { ISerializedCartItemWithName } from '../models/cart.ts';

export const isDuckTypeSerializedModifier = (data: unknown): data is ISerializedModifier => {
    if (!isDuckType<ISerializedModifier>(data, { modifierId: 'string', choiceIds: 'object' })) {
        return false;
    }

    if (!Array.isArray(data.choiceIds)) {
        return false;
    }

    return data.choiceIds.every(choiceId => typeof choiceId === 'string');
}

export const isDuckTypeSerializedCartItem = (data: unknown): data is ISerializedCartItemWithName => {
    if (!isDuckType<ISerializedCartItemWithName>(data, {
        itemId:    'string',
        quantity:  'number',
        modifiers: 'object',
        name:      'string',
    })) {
        return false;
    }

    if (data.specialInstructions != null && typeof data.specialInstructions !== 'string') {
        return false;
    }

    if (!data.modifiers.every(isDuckTypeSerializedModifier)) {
        return false;
    }

    return true;
}