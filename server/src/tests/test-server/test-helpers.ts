/**
 * Helpers shared across integration tests. Keeps fetch+parse boilerplate
 * out of every test body and forces all response parsing through zod.
 */

import * as assert from 'node:assert/strict';
import type { z } from 'zod';
import { VERSION_TAG_HEADER } from '@msdining/common/constants/versions';

interface FetchJsonOptions extends RequestInit {
    /** Expected status code. Defaults to 200. */
    expectStatus?: number;
    /**
     * If set, adds the X-Client-Version-Tag header. Use this to exercise
     * version-tag-gated server behavior (e.g. legacy route fallbacks).
     * Pass undefined to omit the header entirely (default).
     */
    versionTag?: number;
}

const buildInit = (init: RequestInit, versionTag: number | undefined): RequestInit => {
    if (versionTag == null) {
        return init;
    }
    return {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            [VERSION_TAG_HEADER]: String(versionTag),
        },
    };
};

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
    const { expectStatus = 200, versionTag, ...init } = options;
    const finalInit = buildInit(init, versionTag);
    const res = await fetch(url, finalInit);
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

interface FetchExpectStatusOptions extends RequestInit {
    /** Same semantics as fetchJson.versionTag — adds the X-Client-Version-Tag header. */
    versionTag?: number;
}

/**
 * Performs a fetch and asserts the status code matches `expectStatus`
 * without parsing the body. Use for endpoints that return non-JSON or
 * when the body shape isn't relevant to the test.
 */
export async function fetchExpectStatus(
    url: string,
    expectStatus: number,
    options: FetchExpectStatusOptions = {},
): Promise<Response> {
    const { versionTag, ...init } = options;
    const finalInit = buildInit(init, versionTag);
    const res = await fetch(url, finalInit);
    if (res.status !== expectStatus) {
        const bodyText = await res.text().catch(() => '<unable to read body>');
        assert.fail(
            `${init.method ?? 'GET'} ${url} returned ${res.status} ${res.statusText} (expected ${expectStatus})\nBody: ${bodyText.slice(0, 500)}`,
        );
    }
    return res;
}
