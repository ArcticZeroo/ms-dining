import { runPromiseWithRetries } from '../../util/async.js';
import { rethrowWithoutStatus } from '../../util/error.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from './provider.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openAiProvider } from './providers/openai.js';
import { hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import { logInfo } from '../../util/log.js';

const AI_PROVIDER_ENV_VAR = 'AI_PROVIDER';
const AI_RETRY_COUNT = 3;

const computeDefaultProvider = (): IAiProvider => {
    const providerName = process.env[AI_PROVIDER_ENV_VAR]?.toLowerCase();

    if (providerName === 'openai') {
        return openAiProvider;
    }

    if (providerName === 'anthropic' || hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.anthropicApiKey)) {
        return anthropicProvider;
    }

    // Anthropic key not set — fall back to OpenAI (already required for embeddings)
    logInfo('[AI] ANTHROPIC_API_KEY not set, falling back to OpenAI for text/vision completions');
    return openAiProvider;
};

// Held in a mutable cell so integration tests can inject a mock implementation
// via setAiProvider(...). The default is computed lazily on first use so tests
// can override before any AI call fires.
let activeProvider: IAiProvider | null = null;

export const getActiveAiProvider = (): IAiProvider => {
    if (activeProvider == null) {
        activeProvider = computeDefaultProvider();
    }
    return activeProvider;
};

export const setAiProvider = (provider: IAiProvider | null): void => {
    activeProvider = provider;
};

export const resetAiProvider = (): void => {
    activeProvider = null;
};

export const retrieveTextCompletion = async (request: IAiTextCompletionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => getActiveAiProvider().retrieveTextCompletion(request),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};

export const retrieveVisionCompletion = async (request: IAiVisionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => getActiveAiProvider().retrieveVisionCompletion(request),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};

export const retrieveEmbedding = async (text: string): Promise<number[]> => {
    return runPromiseWithRetries(
        () => getActiveAiProvider().retrieveEmbedding(text),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};
