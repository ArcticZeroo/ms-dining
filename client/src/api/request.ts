import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/dist/constants/versions';
import { ERROR_BODIES } from '@msdining/common/dist/responses';

import { getVisitorId } from '../constants/settings.ts';
import { MenusCurrentlyUpdatingException } from '../util/exception.ts';

interface IMakeRequestParamsBase {
    path: string;
    options?: RequestInit;
}

export const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

export const getDefaultHeaders = (): Record<string, string> => {
    return {
        'X-Visitor-Id': getVisitorId(),
        'Content-Type': 'application/json',
        [VERSION_TAG_HEADER]: VERSION_TAG.searchResultsNotHereThisWeek.toString(),
    };
}

export const makeJsonRequestNoParse = async ({
    path,
    options = {},
}: IMakeRequestParamsBase): Promise<Response> => {
    const headers = options.headers ?? {};

    const response = await fetch(path, {
        ...options,
        headers: {
            ...getDefaultHeaders(),
            ...headers
        },
    });

    if (!response.ok) {
        if (response.status === 503) {
            const body = await response.text();
            if (body === ERROR_BODIES.menusCurrentlyUpdating) {
                throw new MenusCurrentlyUpdatingException();
            }
        }

        throw new Error(`Response failed with status: ${response.status}`);
    }

    return response;
}

export const makeJsonRequest = async <T>({
    path,
    options = {},
}: IMakeRequestParamsBase): Promise<T> => {
    const response = await makeJsonRequestNoParse({ path, options });
    return response.json();
}