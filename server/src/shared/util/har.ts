import { writeFile, mkdir } from 'fs/promises';
import { logError, logInfo } from './log.js';
import path from 'path';

export interface IHarEntry {
    startedDateTime: string;
    time: number;
    request: {
        method: string;
        url: string;
        headers: Array<{ name: string; value: string }>;
        postData?: {
            mimeType: string;
            text: string;
        };
    };
    response: {
        status: number;
        statusText: string;
        headers: Array<{ name: string; value: string }>;
        content: {
            size: number;
            mimeType: string;
            text: string;
        };
    };
}

export class HarCapture {
    readonly #entries: IHarEntry[] = [];

    addEntry(entry: IHarEntry) {
        this.#entries.push(entry);
    }

    toJSON() {
        return {
            log: {
                version: '1.2',
                creator: { name: 'ms-dining', version: '1.0' },
                entries: this.#entries,
            }
        };
    }

    get size() {
        return this.#entries.length;
    }

    async writeToFile(cafeId: string) {
        try {
            const dir = path.resolve('har-captures');
            await mkdir(dir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = path.join(dir, `${cafeId}-${timestamp}.har`);
            await writeFile(filename, JSON.stringify(this.toJSON(), null, 2));
            logInfo(`[HAR] Wrote ${this.#entries.length} entries to ${filename}`);
        } catch (err) {
            logError('[HAR] Failed to write HAR file:', err);
        }
    }
}

/**
 * Captures a fetch call as a HAR entry.
 * Clones the response so the body can still be consumed by the caller.
 */
/**
 * Build a HAR entry from already-read response data.
 * The caller is responsible for reading the body text and providing it here
 * so that the original response stream is not cloned (which can deadlock).
 */
export const buildHarEntry = (
    url: string,
    options: { method?: string; headers?: Record<string, string>; body?: string },
    response: { status: number; statusText: string; headers: Iterable<[string, string]>; contentType?: string },
    responseText: string,
): IHarEntry => {
    const startedDateTime = new Date().toISOString();

    const requestHeaders = Object.entries(options.headers ?? {}).map(
        ([name, value]) => ({ name, value })
    );

    const responseHeaders = Array.from(response.headers).map(
        ([name, value]) => ({ name, value })
    );

    return {
        startedDateTime,
        time:     0,
        request:  {
            method:   options.method ?? 'GET',
            url,
            headers:  requestHeaders,
            ...(options.body != null && {
                postData: {
                    mimeType: 'application/json',
                    text:     options.body,
                }
            }),
        },
        response: {
            status:     response.status,
            statusText: response.statusText,
            headers:    responseHeaders,
            content:    {
                size:     responseText.length,
                mimeType: response.contentType ?? 'application/json',
                text:     responseText,
            }
        },
    };
};
