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
}
