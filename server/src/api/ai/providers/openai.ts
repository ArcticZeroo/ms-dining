import OpenAI from 'openai';
import { getOpenAiKey } from '../../../constants/env.js';
import { lazy } from '../../../util/lazy.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from '../provider.js';

const DEFAULT_MAX_TOKENS = 1024;

const getClient = lazy(() => new OpenAI({
    apiKey: getOpenAiKey()
}));

export const openAiProvider: IAiProvider = {
    async retrieveTextCompletion(request: IAiTextCompletionRequest): Promise<string> {
        const response = await getClient().chat.completions.create({
            model:      'gpt-5.2',
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages:   [
                {
                    role:    'system',
                    content: request.systemPrompt
                },
                {
                    role:    'user',
                    content: request.userMessage
                }
            ]
        });

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
        const response = await getClient().chat.completions.create({
            model:      'gpt-5.2',
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages:   [
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
        });

        const choice = response.choices[0];
        if (!choice) {
            throw new Error('OpenAI did not return a choice');
        }

        const message = choice.message.content;
        if (!message) {
            throw new Error('OpenAI vision completion did not return a message');
        }

        return message;
    }
};
