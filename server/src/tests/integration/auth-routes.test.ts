/**
 * Integration test for `17f6423` — auth setup must fail loudly, not
 * silently, when its environment is misconfigured.
 *
 * Three scenarios:
 *   1. `SESSION_SECRET` unset → importing `app.ts` throws at module init.
 *   2. Auth env vars unset (but session secret present) → `app.ts` loads
 *      successfully but auth routes (`/api/auth/microsoft/login`, etc.)
 *      are not registered, so requests hit the API catch-all 404.
 *   3. With all auth env vars set, `/api/auth/me` IS registered and
 *      enforces auth (401 when unauthenticated). The route must not be
 *      cached as a public, shareable response.
 *
 * Scenarios 1 and 2 run in subprocesses because `app.ts` reads its env
 * variables at module-init time and the ES module registry caches the
 * result for the life of the process. Scenario 3 uses the regular
 * integration context, but takes care to set AUTH env vars BEFORE
 * `app.ts` is first imported (which happens lazily inside startWebserver).
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../../constants/env.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../test-server/integration-test-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist/tests/integration → dist/. The subprocess imports the compiled app
// via a file:// URL — required on Windows where bare absolute paths like
// `I:\…\app.js` aren't valid ESM specifiers.
const APP_DIST_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'app.js')).href;
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const AUTH_VAR_NAMES: ReadonlyArray<keyof typeof WELL_KNOWN_ENVIRONMENT_VARIABLES> = [
    'authMicrosoftClientId',
    'authMicrosoftClientSecret',
    'authMicrosoftCallbackUrl',
    'authGoogleClientId',
    'authGoogleClientSecret',
    'authGoogleCallbackUrl',
];

const TEST_AUTH_ENV: Record<string, string> = {
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientId]: 'test-microsoft-client-id',
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientSecret]: 'test-microsoft-client-secret',
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftCallbackUrl]: 'http://localhost/auth/microsoft/callback',
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleClientId]: 'test-google-client-id',
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleClientSecret]: 'test-google-client-secret',
    [WELL_KNOWN_ENVIRONMENT_VARIABLES.authGoogleCallbackUrl]: 'http://localhost/auth/google/callback',
};

/**
 * Build a clean env for a subprocess: PATH + a placeholder DATABASE_URL
 * and SEARCH_DB_PATH (so any eager Prisma/vec init doesn't crash on path),
 * plus whatever overrides the caller provides. Defaults SESSION_SECRET and
 * every AUTH_* variable to empty strings so that the `@prisma/client`-
 * bundled dotenv loader (which reads `server/.env` at module init) cannot
 * silently repopulate them — dotenv only fills *unset* variables, not
 * empty ones. Callers override individual entries to non-empty values
 * when they want them present.
 */
const buildSubprocessEnv = (overrides: Record<string, string | undefined>): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TMP: process.env.TMP,
        TEMP: process.env.TEMP,
        DATABASE_URL: 'file:./auth-routes-test-placeholder.db',
        SEARCH_DB_PATH: './auth-routes-test-placeholder-search.db',
        // Empty defaults block dotenv from importing real values from .env.
        // dotenv preserves the value of any var that's already set, even ''.
        [WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret]: '',
        [WELL_KNOWN_ENVIRONMENT_VARIABLES.appInsightsConnectionString]: '',
        ...Object.fromEntries(AUTH_VAR_NAMES.map((key) => [WELL_KNOWN_ENVIRONMENT_VARIABLES[key], ''])),
    };
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete env[key];
        } else {
            env[key] = value;
        }
    }
    return env;
};

let ctx: IntegrationTestContext;
let baseUrl: string;

before(async () => {
    // Set ALL auth env vars BEFORE startWebserver triggers app.ts import.
    // The integration context doesn't touch SESSION_SECRET / AUTH_* itself,
    // so we control them here.
    process.env[WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret] = 'test-session-secret-for-integration-tests';
    for (const [key, value] of Object.entries(TEST_AUTH_ENV)) {
        process.env[key] = value;
    }

    ctx = await createIntegrationTestContext();
    baseUrl = await ctx.startWebserver();
}, { timeout: 120_000 });

after(async () => {
    await ctx.cleanup();
});

test('importing app.ts throws when SESSION_SECRET is unset', () => {
    // The subprocess strips SESSION_SECRET (and all auth vars) before
    // importing the compiled app. We assert that the import rejects with
    // a recognisable message and the process exits non-zero. Captured via
    // a small inline harness that prints the error to stderr.
    const script = `
        import('${APP_DIST_URL}')
            .then(() => { process.exit(0); })
            .catch((err) => {
                process.stderr.write(String(err && err.message ? err.message : err));
                process.exit(2);
            });
    `;

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: buildSubprocessEnv({}),
        cwd: SERVER_ROOT,
        encoding: 'utf-8',
        timeout: 30_000,
    });

    assert.equal(result.status, 2, `expected exit code 2; got ${result.status}. stdout=${result.stdout} stderr=${result.stderr}`);
    assert.match(
        result.stderr,
        /SESSION_SECRET/,
        `expected error to mention SESSION_SECRET; got: ${result.stderr}`,
    );
});

test('auth routes are NOT registered when auth env vars are missing', () => {
    // Auth env vars unset (only SESSION_SECRET is set). App should boot,
    // hasAuthEnvironmentVariables() returns false in registerAuthRoutes,
    // and /api/auth/* requests fall through to the API catch-all → 404.
    // Empty strings (not `undefined`) so the @prisma/client-bundled dotenv
    // loader cannot resurrect them from `server/.env`.
    const overrides: Record<string, string | undefined> = {
        SESSION_SECRET: 'test-session-secret-for-integration-tests',
    };
    for (const name of AUTH_VAR_NAMES) {
        overrides[WELL_KNOWN_ENVIRONMENT_VARIABLES[name]] = '';
    }

    const script = `
        const appModule = await import('${APP_DIST_URL}');
        const http = await import('node:http');
        const server = http.createServer(appModule.app.callback());
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
        });
        const addr = server.address();
        try {
            const loginRes = await fetch('http://127.0.0.1:' + addr.port + '/api/auth/microsoft/login', { redirect: 'manual' });
            const meRes = await fetch('http://127.0.0.1:' + addr.port + '/api/auth/me', { redirect: 'manual' });
            process.stdout.write(JSON.stringify({ loginStatus: loginRes.status, meStatus: meRes.status }));
        } finally {
            await new Promise((resolve) => server.close(() => resolve()));
        }
        process.exit(0);
    `;

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: buildSubprocessEnv(overrides),
        cwd: SERVER_ROOT,
        encoding: 'utf-8',
        timeout: 60_000,
    });

    assert.equal(
        result.status,
        0,
        `subprocess exited non-zero (${result.status}). stdout=${result.stdout}\nstderr=${result.stderr}`,
    );
    let parsed: { loginStatus: number; meStatus: number };
    try {
        // The subprocess emits log lines from production modules before
        // our JSON payload. Read the JSON object off the last non-empty
        // stdout line.
        const lastLine = result.stdout.trim().split(/\r?\n/).pop();
        parsed = JSON.parse(lastLine ?? '');
    } catch (err) {
        assert.fail(
            `failed to parse subprocess stdout as JSON: ${err instanceof Error ? err.message : err}\n` +
            `stdout=${JSON.stringify(result.stdout)}\nstderr=${result.stderr}`,
        );
    }
    assert.equal(parsed.loginStatus, 404, `/api/auth/microsoft/login should 404 when auth env vars are unset; got ${parsed.loginStatus}`);
    assert.equal(parsed.meStatus, 404, `/api/auth/me should 404 when auth env vars are unset; got ${parsed.meStatus}`);
});

test('/api/auth/me is registered and protected when auth env vars are set', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, { redirect: 'manual' });
    // requireAuthenticated rejects the unauthenticated request with 401.
    // The fact that we get 401 (not 404) proves the route is registered.
    assert.equal(res.status, 401, `expected 401 for unauthenticated /auth/me; got ${res.status}`);
});

// Note: a test asserting Cache-Control isn't `public` on /auth/me would be
// vacuous here — the route returns 401 for unauthenticated requests and Koa
// skips cache-control on error responses regardless of route config. The
// real cache-leak risk is on authenticated 200 responses, which would
// require driving the OAuth flow end-to-end. That isn't currently testable
// against the mock BoD server, so the cache-leak assertion is intentionally
// omitted rather than written as a false-positive.
