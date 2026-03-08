import { runPromiseWithRetries } from '../../util/async.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from './provider.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openAiProvider } from './providers/openai.js';

const AI_PROVIDER_ENV_VAR = 'AI_PROVIDER';
const AI_RETRY_COUNT = 3;

const getProvider = (): IAiProvider => {
    const providerName = process.env[AI_PROVIDER_ENV_VAR]?.toLowerCase();

    switch (providerName) {
        case 'openai':
            return openAiProvider;
        case 'anthropic':
        default:
            return anthropicProvider;
    }
};

const activeProvider = getProvider();

export const retrieveTextCompletion = async (request: IAiTextCompletionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => activeProvider.retrieveTextCompletion(request),
        AI_RETRY_COUNT
    );
};

export const retrieveVisionCompletion = async (request: IAiVisionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => activeProvider.retrieveVisionCompletion(request),
        AI_RETRY_COUNT
    );
};
