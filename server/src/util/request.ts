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
		return '(response text unavailable)';
	}
};

interface IMakeRequestOptions {
	makeRequest: (retry: number) => Promise<Response>;
	retryCount?: number;
	shouldRetry?: (response: Response) => boolean;
}

export const isResponseServerError = (response: Response) => response.status.toString().startsWith('5');

export const makeRequestWithRetries = async ({ makeRequest, retryCount = 3, shouldRetry }: IMakeRequestOptions): Promise<Response> => {
	return runPromiseWithRetries(
		async (i) => {
			const response = await makeRequest(i);

			if (shouldRetry != null && !shouldRetry(response)) {
				throw new Error(`Response failed: ${response.status} ${await tryGetResponseText(response)}`);
			}

			return response;
		},
		retryCount,
		1000 /*delayMs*/
	);
};