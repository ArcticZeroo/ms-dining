/**
 * Test auth helpers — create users and make authenticated HTTP requests
 * against the test webserver without driving the real OAuth flow.
 *
 * How it works:
 *   1. Creates a real User row via `data.user.createUser()`.
 *   2. Creates a real Session row via `data.session.set()`.
 *   3. Sets the raw session ID as the `koa:sess` cookie (session signing
 *      is disabled in the test webserver via `sessionSigned: false`).
 *
 * No production code changes — exercises the real session store, passport
 * deserialisation, and `requireAuthenticated` middleware end-to-end.
 */

import * as crypto from 'node:crypto';
import { getServices } from '../../main/services/registry.js';
import type { IServerUser } from '../../shared/models/auth.js';
import type { ICreateUserInput } from '../../shared/services/user.js';

const COOKIE_NAME = 'koa.sess';

// ── Public: user creation ───────────────────────────────────────────────

/**
 * Creates a real user in the test database.
 * Returns the full `IServerUser` (including the internal `.id`).
 */
export async function createTestUser(
    overrides?: Partial<ICreateUserInput>,
): Promise<IServerUser> {
    const user: ICreateUserInput = {
        displayName: overrides?.displayName ?? 'Test User',
        externalId:  overrides?.externalId ?? `test-ext-${crypto.randomUUID()}`,
        provider:    overrides?.provider ?? 'test',
    };
    return getServices().data.user.createUser({ user });
}

// ── Internal: session + cookie management ───────────────────────────────

/**
 * Manages per-user session creation and cookie caching so that repeated
 * `fetchAs` calls for the same user don't re-create sessions.
 */
export class TestAuthManager {
    /** userId → cookie header string */
    private readonly cookieCache = new Map<string, string>();

    /**
     * Returns the `Cookie` header value for an authenticated session
     * belonging to `userId`. Lazily creates the DB session row and caches
     * the cookie for subsequent calls.
     */
    async getCookieHeader(userId: string): Promise<string> {
        const cached = this.cookieCache.get(userId);
        if (cached) {
            return cached;
        }

        const sessionId = crypto.randomUUID();

        await getServices().data.session.set({
            sessionId,
            sessionData: { passport: { user: userId } },
            maxAge:      86_400_000, // 1 day — more than enough for a test run
        });

        const header = `${COOKIE_NAME}=${sessionId}`;
        this.cookieCache.set(userId, header);
        return header;
    }

    /**
     * Like `fetch()`, but sends the request as `userId`.
     */
    async fetchAs(
        userId: string,
        url: string,
        init?: RequestInit,
    ): Promise<Response> {
        const cookie = await this.getCookieHeader(userId);

        const headers = new Headers(init?.headers);
        headers.set('Cookie', cookie);

        return fetch(url, { ...init, headers, redirect: 'manual' });
    }
}
