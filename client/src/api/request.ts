import { ERROR_BODIES } from '@msdining/common/dist/responses';
import { MenusCurrentlyUpdatingException } from '../util/exception.ts';
import { getVisitorId } from './settings.ts';

const getRequestOptions = (sendVisitorId: boolean) => {
    if (!sendVisitorId) {
        return undefined;
    }

    return {
        headers: {
            'X-Visitor-Id': getVisitorId()
        }
    };
}

interface IMakeRequestParams {
    path: string;
    sendVisitorId?: boolean;
    options?: RequestInit;
}

export const makeRequest = async <T>({
    path,
    sendVisitorId = false,
    options = {}
}: IMakeRequestParams): Promise<T> => {
    const response = await fetch(path, {
        ...getRequestOptions(sendVisitorId),
        ...options
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