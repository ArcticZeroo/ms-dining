import { ERROR_BODIES } from '@msdining/common/dist/responses';
import { MenusCurrentlyUpdatingException } from '../util/exception.ts';

import { getVisitorId } from '../constants/settings.ts';
import { VERSION_TAG, VERSION_TAG_HEADER } from "@msdining/common/dist/constants/versions";

interface IMakeRequestParams {
    path: string;
    options?: RequestInit;
}

export const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

export const makeJsonRequest = async <T>({
    path,
    options = {}
}: IMakeRequestParams): Promise<T> => {
    const headers = options.headers ?? {};

    const response = await fetch(path, {
        ...options,
        headers: {
            'X-Visitor-Id': getVisitorId(),
            [VERSION_TAG_HEADER]: VERSION_TAG.modifiersInSearchResults.toString(),
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

    return response.json();
}