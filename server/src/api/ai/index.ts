import { runPromiseWithRetries } from '../../util/async.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from './provider.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openAiProvider } from './providers/openai.js';
import { hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import { logInfo } from '../../util/log.js';

const AI_PROVIDER_ENV_VAR = 'AI_PROVIDER';
const AI_RETRY_COUNT = 3;

const getProvider = (): IAiProvider => {
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
