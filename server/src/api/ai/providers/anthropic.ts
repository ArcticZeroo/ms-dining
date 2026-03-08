import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey } from '../../../constants/env.js';
import { lazy } from '../../../util/lazy.js';
import { IAiProvider, IAiTextCompletionRequest, IAiVisionRequest } from '../provider.js';

const DEFAULT_MAX_TOKENS = 1024;

const getClient = lazy(() => new Anthropic({
    apiKey: getAnthropicKey()
}));

export const anthropicProvider: IAiProvider = {
    async retrieveTextCompletion(request: IAiTextCompletionRequest): Promise<string> {
        const response = await getClient().messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            system:     request.systemPrompt,
            messages:   [
                {
                    role:    'user',
                    content: request.userMessage
                }
            ]
        });

        const block = response.content[0];
        if (!block || block.type !== 'text') {
            throw new Error('Anthropic did not return a text response');
        }

        return block.text;
    },

    async retrieveVisionCompletion(request: IAiVisionRequest): Promise<string> {
        const response = await getClient().messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            system:     request.systemPrompt,
            messages:   [
                {
                    role:    'user',
                    content: [
                        {
                            type:   'image',
                            source: {
                                type:       'base64',
                                media_type: request.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                                data:       request.imageBase64
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

        const block = response.content[0];
        if (!block || block.type !== 'text') {
            throw new Error('Anthropic did not return a text response');
        }

        return block.text;
    }
};
