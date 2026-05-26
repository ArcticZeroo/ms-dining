/**
 * MockAiProvider — deterministic, in-memory IAiProvider implementation for
 * integration tests.
 *
 * Defaults are designed to be "good enough" so most tests don't need to mock
 * anything — but every call can be overridden per-test.
 *
 *   - Embeddings: deterministic seeded Float32Array[1536] keyed off input.
 *     Same input → same vector. Different inputs → distinct vectors.
 *     This means similarity search still works meaningfully.
 *
 *   - Text completions: heuristic responses keyed off the systemPrompt. We
 *     recognize the known callers (search-tag generation, shutdown classifier,
 *     station theme, ingredient categorizer) and return plausibly-shaped
 *     output. Unrecognized prompts fall back to a generic mock string.
 *
 *   - Vision completions: returns a generic placeholder unless overridden.
 *
 * Tests can override defaults via setTextResponse / setVisionResponse /
 * setEmbedding, and inspect the call log via getCalls().
 */

import seedrandom from 'seedrandom';
import {
    IAiProvider,
    IAiTextCompletionRequest,
    IAiVisionRequest,
} from '../../worker/data/ai/provider.js';

const EMBEDDING_DIMENSIONS = 1536;

export type MockTextMatcher =
    | string
    | RegExp
    | ((req: IAiTextCompletionRequest) => boolean);

export type MockTextResponder = string | ((req: IAiTextCompletionRequest) => string);
export type MockVisionResponder = string | ((req: IAiVisionRequest) => string);

interface TextOverride {
    matcher: MockTextMatcher;
    responder: MockTextResponder;
}

interface VisionOverride {
    matcher: MockTextMatcher;
    responder: MockVisionResponder;
}

export interface MockAiCall {
    kind: 'text' | 'vision' | 'embedding';
    /** For text/vision: the request. For embedding: the input string. */
    payload: IAiTextCompletionRequest | IAiVisionRequest | string;
    /** What was returned. */
    response: string | number[];
    timestamp: number;
}

const matchesText = (matcher: MockTextMatcher, req: IAiTextCompletionRequest): boolean => {
    if (typeof matcher === 'string') {
        return req.systemPrompt.includes(matcher) || req.userMessage.includes(matcher);
    }
    if (matcher instanceof RegExp) {
        return matcher.test(req.systemPrompt) || matcher.test(req.userMessage);
    }
    return matcher(req);
};

/**
 * Deterministically generates a 1536-float embedding from arbitrary input.
 * Values are roughly in [-1, 1] and normalized to unit length so cosine
 * similarity behaves naturally.
 */
export const deterministicEmbedding = (input: string): number[] => {
    const rng = seedrandom(`embedding::${input}`);
    const values = new Array<number>(EMBEDDING_DIMENSIONS);
    let normSq = 0;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
        // Map [0, 1) to [-1, 1) so the vector is centered around 0.
        const v = rng() * 2 - 1;
        values[i] = v;
        normSq += v * v;
    }
    const norm = Math.sqrt(normSq) || 1;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
        values[i] = values[i]! / norm;
    }
    return values;
};

/**
 * Heuristic default text response. Looks at the systemPrompt to recognize
 * known callers, otherwise returns a generic mock string.
 */
const defaultTextResponse = (req: IAiTextCompletionRequest): string => {
    const sys = req.systemPrompt.toLowerCase();

    // worker/queues/search-tags.ts — generates comma-separated search tags
    if (sys.includes('search tag') || sys.includes('search tags')) {
        // Echo a few keywords from the user message as comma-separated tags.
        const words = req.userMessage
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .slice(0, 5);
        return words.length > 0 ? words.join(', ') : 'mock, tag';
    }

    // api/cafe/shutdown-classifier.ts — expects XML envelope around JSON
    // classification. We return a benign "full + indefinite shutdown" by
    // default; tests can override with setTextResponse for specific cases.
    if (sys.includes('shutdown') || sys.includes('shut down') || sys.includes('shut off')) {
        return '<shutdown-classification>{"shutdownType":"full","isTemporary":false,"resumeInfo":null}</shutdown-classification>';
    }

    // api/storage/clients/station-theme.ts — generates a short station theme name
    if (sys.includes('theme') || sys.includes('cuisine')) {
        return 'Mock Theme';
    }

    // api/cafe/ingredients/ai-categorizer.ts — returns JSON-shaped categorization
    if (sys.includes('json') || sys.includes('categori')) {
        return '{}';
    }

    return `[MOCK] ${req.userMessage.slice(0, 80)}`;
};

const defaultVisionResponse = (_req: IAiVisionRequest): string => {
    return '[MOCK VISION]';
};

export class MockAiProvider implements IAiProvider {
    private readonly textOverrides: TextOverride[] = [];
    private readonly visionOverrides: VisionOverride[] = [];
    private readonly embeddingOverrides = new Map<string, number[]>();
    private readonly callLog: MockAiCall[] = [];

    // ── Overrides ──────────────────────────────────────────────────────

    setTextResponse(matcher: MockTextMatcher, responder: MockTextResponder): void {
        this.textOverrides.push({ matcher, responder });
    }

    setVisionResponse(matcher: MockTextMatcher, responder: MockVisionResponder): void {
        this.visionOverrides.push({ matcher, responder });
    }

    setEmbedding(input: string, embedding: number[]): void {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
                `Embedding override must have length ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
            );
        }
        this.embeddingOverrides.set(input, embedding);
    }

    // ── Introspection ──────────────────────────────────────────────────

    getCalls(): readonly MockAiCall[] {
        return this.callLog;
    }

    getTextCalls(): IAiTextCompletionRequest[] {
        return this.callLog
            .filter(c => c.kind === 'text')
            .map(c => c.payload as IAiTextCompletionRequest);
    }

    getEmbeddingCalls(): string[] {
        return this.callLog
            .filter(c => c.kind === 'embedding')
            .map(c => c.payload as string);
    }

    clearCallLog(): void {
        this.callLog.length = 0;
    }

    reset(): void {
        this.textOverrides.length = 0;
        this.visionOverrides.length = 0;
        this.embeddingOverrides.clear();
        this.callLog.length = 0;
    }

    // ── IAiProvider implementation ─────────────────────────────────────

    async retrieveTextCompletion(request: IAiTextCompletionRequest): Promise<string> {
        // Iterate overrides in reverse so the most-recently-added wins.
        for (let i = this.textOverrides.length - 1; i >= 0; i--) {
            const override = this.textOverrides[i]!;
            if (matchesText(override.matcher, request)) {
                const response = typeof override.responder === 'function'
                    ? override.responder(request)
                    : override.responder;
                this.callLog.push({ kind: 'text', payload: request, response, timestamp: Date.now() });
                return response;
            }
        }
        const response = defaultTextResponse(request);
        this.callLog.push({ kind: 'text', payload: request, response, timestamp: Date.now() });
        return response;
    }

    async retrieveVisionCompletion(request: IAiVisionRequest): Promise<string> {
        for (let i = this.visionOverrides.length - 1; i >= 0; i--) {
            const override = this.visionOverrides[i]!;
            if (matchesText(override.matcher, request)) {
                const response = typeof override.responder === 'function'
                    ? override.responder(request)
                    : override.responder;
                this.callLog.push({ kind: 'vision', payload: request, response, timestamp: Date.now() });
                return response;
            }
        }
        const response = defaultVisionResponse(request);
        this.callLog.push({ kind: 'vision', payload: request, response, timestamp: Date.now() });
        return response;
    }

    async retrieveEmbedding(text: string): Promise<number[]> {
        const override = this.embeddingOverrides.get(text);
        const response = override ?? deterministicEmbedding(text);
        this.callLog.push({ kind: 'embedding', payload: text, response, timestamp: Date.now() });
        return response;
    }
}
