import { Response } from 'node-fetch';
import { runPromiseWithRetries } from './async.js';

export const validateSuccessResponse = (response: Response) => {
    if (!response.ok) {
        throw new Error(`Response failed with status: ${response.status}`);
    }
};

export const tryGetResponseText = async (response: Response) => {
    try {
        return await response.text();
    } catch (err) {
        return '';
    }
}

export const makeRequestWithRetries = async (makeRequest: (retry: number) => Promise<Response>, retryCount: number = 3): Promise<Response> => {
    return runPromiseWithRetries(async (i) => {
        const response = await makeRequest(i);

        // We only want to retry 5xx errors, anything else could be a client error
        if (response.status.toString().startsWith('5')) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(`Response failed: ${response.status} ${await tryGetResponseText(response)}`);
        }

        return response;
    }, retryCount);
}