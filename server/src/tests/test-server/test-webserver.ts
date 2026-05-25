/**
 * Test webserver — boots the Koa app on a random free port for HTTP-level
 * integration tests.
 *
 * Lazily started via `startWebserver()` so tests that only exercise
 * services (no HTTP) don't pay the import/boot cost.
 */

import * as http from 'node:http';
import type { Services } from '../../shared/services/types.js';

export interface TestWebserverHandle {
    /** Base URL of the test webserver, e.g. http://127.0.0.1:54321 */
    url: string;
    /** Shut down the webserver. */
    close(): Promise<void>;
}

/**
 * Creates a lazy webserver factory. The first call boots the Koa app on a
 * random free port; subsequent calls return the same URL. The webserver is
 * torn down by calling `handle.close()`.
 */
export function createLazyWebserver(services: Services) {
    let webserver: TestWebserverHandle | null = null;

    const start = async (): Promise<string> => {
        if (webserver) {
            return webserver.url;
        }

        // Dynamic import so loading the app (which constructs Koa, registers
        // routes, requires SESSION_SECRET, etc.) only happens for tests that
        // actually exercise HTTP — keeps the smoke test light.
        const { createApp } = await import('../../main/app.js');
        const app = createApp(services, { sessionSigned: false });
        const httpServer = http.createServer(app.callback());

        await new Promise<void>((resolve, reject) => {
            httpServer.once('error', reject);
            httpServer.listen(0, '127.0.0.1', () => {
                httpServer.off('error', reject);
                resolve();
            });
        });

        const addr = httpServer.address();
        if (addr == null || typeof addr === 'string') {
            throw new Error('Test webserver did not bind to a TCP port');
        }

        const url = `http://127.0.0.1:${addr.port}`;
        webserver = {
            url,
            close: () => new Promise<void>((resolve, reject) =>
                httpServer.close(err => err ? reject(err) : resolve())),
        };
        return url;
    };

    const cleanup = async (): Promise<void> => {
        if (webserver) {
            try {
                await webserver.close();
            } catch {
                // Best-effort.
            }
            webserver = null;
        }
    };

    return { start, cleanup };
}
