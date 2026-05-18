export interface IAiTextCompletionRequest {
    systemPrompt: string;
    userMessage: string;
    maxTokens?: number;
}

export interface IAiVisionRequest extends IAiTextCompletionRequest {
    imageBase64: string;
    mimeType: string;
}

export interface IAiProvider {
    retrieveTextCompletion(request: IAiTextCompletionRequest): Promise<string>;
    retrieveVisionCompletion(request: IAiVisionRequest): Promise<string>;
    /**
     * Returns a 1536-dimensional embedding (length matches OpenAI's
     * text-embedding-3-small, which is the only embeddings model the codebase
     * currently uses). Used for vector search.
     */
    retrieveEmbedding(text: string): Promise<number[]>;
}
