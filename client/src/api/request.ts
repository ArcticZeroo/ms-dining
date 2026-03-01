import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/constants/versions';

import { getVisitorId } from '../constants/settings.ts';
import { HttpException } from '../exception/http.ts';
import z, { ZodType } from 'zod';

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
        [VERSION_TAG_HEADER]: VERSION_TAG.userNotInCafeList.toString(),
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
        throw new HttpException(response.status);
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

interface IMakeJsonRequestWithSchemaParams<T extends ZodType> extends IMakeRequestParamsBase {
    schema: T;
}

export const makeJsonRequestWithSchema = async <T extends ZodType>({
    path,
    options,
    schema
}: IMakeJsonRequestWithSchemaParams<T>): Promise<z.output<T>> => {
    const json = await makeJsonRequest<unknown>({ path, options });
    return schema.parse(json);
}