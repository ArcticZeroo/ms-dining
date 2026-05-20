import { runPromiseWithRetries } from '../../shared/util/async.js';
import { rethrowWithoutStatus } from '../../shared/util/error.js';
import { getServices } from '../../main/services/registry.js';
import { hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../shared/constants/env.js';
import { logInfo } from '../../shared/util/log.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openAiProvider } from './providers/openai.js';
import type { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from './provider.js';

const AI_RETRY_COUNT = 3;
const AI_PROVIDER_ENV_VAR = 'AI_PROVIDER';

/** Anthropic-or-OpenAI selection for text + vision. Embeddings are separately wired to OpenAI. */
type TextVisionProvider = typeof anthropicProvider | typeof openAiProvider;

const pickTextVisionProvider = (): TextVisionProvider => {
    const providerName = process.env[AI_PROVIDER_ENV_VAR]?.toLowerCase();

    if (providerName === 'openai') {
        return openAiProvider;
    }

    if (providerName === 'anthropic' || hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.anthropicApiKey)) {
        return anthropicProvider;
    }

    logInfo('[AI] ANTHROPIC_API_KEY not set, falling back to OpenAI for text/vision completions');
    return openAiProvider;
};

/**
 * Builds the production AI provider as an operation-by-operation composite:
 * text + vision use the env-selected provider (Anthropic when available,
 * otherwise OpenAI); embeddings always use OpenAI (Anthropic has no
 * embeddings API). Replaces the previous hack where `anthropicProvider`
 * internally delegated its `retrieveEmbedding` to `openAiProvider`.
 *
 * Lives here (next to its provider modules) rather than in services/production.ts
 * so the services wiring stays a thin composition file — any changes to AI
 * provider selection or composition happen in this module.
 */
export const createProductionAi = (): IAiProvider => {
    const textVision = pickTextVisionProvider();
    return {
        retrieveTextCompletion:   (request) => textVision.retrieveTextCompletion(request),
        retrieveVisionCompletion: (request) => textVision.retrieveVisionCompletion(request),
        retrieveEmbedding:        (text)    => openAiProvider.retrieveEmbedding(text),
    };
};

/**
 * Thin retry wrappers over the active AI provider. The provider is resolved
 * per-call via `getServices().ai`, so tests' scoped overrides take effect
 * without any module-level state mutation.
 */
export const retrieveTextCompletion = async (request: IAiTextCompletionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => getServices().ai.retrieveTextCompletion(request),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};

export const retrieveVisionCompletion = async (request: IAiVisionRequest): Promise<string> => {
    return runPromiseWithRetries(
        () => getServices().ai.retrieveVisionCompletion(request),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};

export const retrieveEmbedding = async (text: string): Promise<number[]> => {
    return runPromiseWithRetries(
        () => getServices().ai.retrieveEmbedding(text),
        AI_RETRY_COUNT
    ).catch(rethrowWithoutStatus);
};
