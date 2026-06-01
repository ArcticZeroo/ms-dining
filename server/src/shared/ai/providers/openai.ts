import { AzureOpenAI, RateLimitError } from 'openai';
import { getOpenAiKey } from '../../constants/env.js';
import { lazy } from '../../util/lazy.js';
import { WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import { RetryAfterError } from '../../util/error.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from '../provider.js';

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_API_VERSION = '2025-04-01-preview';
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;

const getAzureConfig = () => ({
    endpoint:   process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.azureOpenAiEndpoint]!,
    apiVersion: process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.azureOpenAiApiVersion] || DEFAULT_API_VERSION,
    chatDeployment:      process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.azureOpenAiChatDeployment] || 'gpt-5.4',
    embeddingDeployment: process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.azureOpenAiEmbeddingDeployment] || 'text-embedding-3-small',
});

const CLIENT = lazy(() => {
    const config = getAzureConfig();
    return new AzureOpenAI({
        endpoint:   config.endpoint,
        apiKey:     getOpenAiKey(),
        apiVersion: config.apiVersion,
    });
});

const CONFIG = lazy(getAzureConfig);

const rethrowRateLimit = (err: unknown): never => {
    if (err instanceof RateLimitError) {
        const retryAfterSec = Number(err.headers?.['retry-after']);
        const retryAfterMs = (!isNaN(retryAfterSec) && retryAfterSec > 0)
            ? retryAfterSec * 1000
            : DEFAULT_RATE_LIMIT_RETRY_MS;
        throw new RetryAfterError(retryAfterMs, err.message);
    }
    throw err;
};

export const openAiProvider: IAiProvider = {
    async retrieveTextCompletion(request: IAiTextCompletionRequest): Promise<string> {
        const response = await CLIENT.value.chat.completions.create({
            model:                CONFIG.value.chatDeployment,
            max_completion_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages:             [
                {
                    role:    'system',
                    content: request.systemPrompt
                },
                {
                    role:    'user',
                    content: request.userMessage
                }
            ]
        }).catch(rethrowRateLimit);

        const choice = response.choices[0];
        if (!choice) {
            throw new Error('OpenAI did not return a choice');
        }

        const message = choice.message.content;
        if (!message) {
            throw new Error('OpenAI chat completion did not return a message');
        }

        return message;
    },

    async retrieveVisionCompletion(request: IAiVisionRequest): Promise<string> {
        const response = await CLIENT.value.chat.completions.create({
            model:                CONFIG.value.chatDeployment,
            max_completion_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages:             [
                {
                    role:    'system',
                    content: request.systemPrompt
                },
                {
                    role:    'user',
                    content: [
                        {
                            type:      'image_url',
                            image_url: {
                                url: `data:${request.mimeType};base64,${request.imageBase64}`
                            }
                        },
                        {
                            type: 'text',
                            text: request.userMessage
                        }
                    ]
                }
            ]
        }).catch(rethrowRateLimit);

        const choice = response.choices[0];
        if (!choice) {
            throw new Error('OpenAI did not return a choice');
        }

        const message = choice.message.content;
        if (!message) {
            throw new Error('OpenAI vision completion did not return a message');
        }

        return message;
    },

    async retrieveEmbedding(text: string): Promise<number[]> {
        const response = await CLIENT.value.embeddings.create({
            model: CONFIG.value.embeddingDeployment,
            input: text
        }).catch(rethrowRateLimit);

        const data = response.data[0];
        if (!data) {
            throw new Error('OpenAI did not return embeddings');
        }

        return data.embedding;
    }
};
