/**
 * Helpers shared across integration tests. Keeps fetch+parse boilerplate
 * out of every test body and forces all response parsing through zod.
 */

import * as assert from 'node:assert/strict';
import type { z } from 'zod';

interface FetchJsonOptions extends RequestInit {
    /** Expected status code. Defaults to 200. */
    expectStatus?: number;
}

/**
 * Performs a fetch, asserts the status code matches `expectStatus`
 * (default 200), then parses the JSON body against the given zod schema.
 * Throws with detailed context on assertion or schema failures.
 */
export async function fetchJson<TSchema extends z.ZodTypeAny>(
    url: string,
    schema: TSchema,
    options: FetchJsonOptions = {},
): Promise<z.infer<TSchema>> {
    const { expectStatus = 200, ...init } = options;
    const res = await fetch(url, init);
    if (res.status !== expectStatus) {
        const bodyText = await res.text().catch(() => '<unable to read body>');
        assert.fail(
            `${init.method ?? 'GET'} ${url} returned ${res.status} ${res.statusText} (expected ${expectStatus})\nBody: ${bodyText.slice(0, 500)}`,
        );
    }
    const body = await res.json();
    const result = schema.safeParse(body);
    if (!result.success) {
        assert.fail(
            `Response from ${init.method ?? 'GET'} ${url} did not match schema:\n${result.error.message}\nBody: ${JSON.stringify(body).slice(0, 500)}`,
        );
    }
    return result.data;
}

/**
 * Performs a fetch and asserts the status code matches `expectStatus`
 * without parsing the body. Use for endpoints that return non-JSON or
 * when the body shape isn't relevant to the test.
 */
export async function fetchExpectStatus(
    url: string,
    expectStatus: number,
    options: RequestInit = {},
): Promise<Response> {
    const res = await fetch(url, options);
    if (res.status !== expectStatus) {
        const bodyText = await res.text().catch(() => '<unable to read body>');
        assert.fail(
            `${options.method ?? 'GET'} ${url} returned ${res.status} ${res.statusText} (expected ${expectStatus})\nBody: ${bodyText.slice(0, 500)}`,
        );
    }
    return res;
}
