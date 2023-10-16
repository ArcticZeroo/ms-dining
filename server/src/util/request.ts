import { Response } from 'node-fetch';

export const validateSuccessResponse = (response: Response) => {
    if (!response.ok) {
        throw new Error(`Response failed with status: ${response.status}`);
    }
};

export const makeRequestWithRetries = async (makeRequest: (retry: number) => Promise<Response>, retryCount: number = 3): Promise<Response> => {
    // <= retryCount so that we get 1 attempt before counting retries
    for (let i = 0; i <= retryCount; i++) {
        try {
            const response = await makeRequest(i);

            // We only want to retry 5xx errors, anything else could be a client error
            if (response.status.toString().startsWith('5')) {
                continue;
            }

            return response;
        } catch (err) {
            if (i === retryCount) {
                throw err;
            }
        }
    }

    throw new Error('Should never reach this state!');
}