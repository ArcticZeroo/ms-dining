import { ISerializedCartItem, ISerializedModifier, ISubmitOrderItems } from '@msdining/common/dist/models/cart.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { IFetchEmbeddingQueryResult, IVectorSearchResult } from '../models/vector.js';

export const isDuckTypeModifier = (data: unknown): data is ISerializedModifier => {
    if (!isDuckType<ISerializedModifier>(data, { modifierId: 'string', choiceIds: 'object' })) {
        return false;
    }

    if (!Array.isArray(data.choiceIds)) {
        return false;
    }

    return data.choiceIds.every(choiceId => typeof choiceId === 'string');
};

export const isDuckTypeSerializedCartItem = (data: unknown): data is ISerializedCartItem => {
    if (!isDuckType<ISerializedCartItem>(data, {
        itemId:    'string',
        quantity:  'number',
        modifiers: 'object',
    })) {
        return false;
    }

    if (data.specialInstructions != null && typeof data.specialInstructions !== 'string') {
        return false;
    }

    if (!data.modifiers.every(isDuckTypeModifier)) {
        return false;
    }

    return true;
};

export const isDuckTypeJsonObject = (data: unknown): data is Record<string, unknown> => {
    return data != null && typeof data === 'object' && !Array.isArray(data);
};

export const isValidItemsByCafeId = (data: unknown): data is ISubmitOrderItems => {
    if (!isDuckTypeJsonObject(data)) {
        return false;
    }

    for (const items of Object.values(data)) {
        if (!Array.isArray(items)) {
            return false;
        }

        if (!items.every(isDuckTypeSerializedCartItem)) {
            return false;
        }
    }

    return true;
};

export const isValidItemIdsByCafeId = (data: unknown): data is Record<string, Array<string>> => {
    if (!isDuckTypeJsonObject(data)) {
        return false;
    }

    for (const itemIds of Object.values(data)) {
        if (!Array.isArray(itemIds)) {
            return false;
        }

        if (!itemIds.every(itemId => typeof itemId === 'string')) {
            return false;
        }
    }

    return true;
};

export const isValidEmbeddingResult = (data: unknown): data is IFetchEmbeddingQueryResult => isDuckType<IFetchEmbeddingQueryResult>(data, {
    embedding: 'object'
});

export const isValidVectorSearchResultArray = (data: unknown): data is Array<IVectorSearchResult> => isDuckTypeArray<IVectorSearchResult>(
    data,
    {
        id:           'string',
        entity_type:  'number',
        distance:     'number',
    }
);