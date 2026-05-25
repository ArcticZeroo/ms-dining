import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { IUpdateUserSettingsInput } from '@msdining/common/models/http';
import { IFetchEmbeddingQueryResult, IVectorSearchResult } from '../models/vector.js';

export const isDuckTypeJsonObject = (data: unknown): data is Record<string, unknown> => {
    return data != null && typeof data === 'object' && !Array.isArray(data);
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

export const isStringArray = (data: unknown): data is Array<string> => {
    if (!Array.isArray(data)) {
        return false;
    }

    return data.every(item => typeof item === 'string');
}

export const isUpdateUserSettingsInput = (input: unknown): input is IUpdateUserSettingsInput => {
    if (input == null || typeof input !== 'object') {
        return false;
    }

    if (!('timestamp' in input) || typeof input.timestamp !== 'number') {
        return false;
    }

    if ('favoriteStations' in input && !isStringArray(input.favoriteStations)) {
        return false;
    }

    if ('favoriteMenuItems' in input && !isStringArray(input.favoriteMenuItems)) {
        return false;
    }

    if ('homepageIds' in input && !isStringArray(input.homepageIds)) {
        return false;
    }

    return true;
}
