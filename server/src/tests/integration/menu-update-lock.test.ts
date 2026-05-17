/**
 * Integration test for `23d8718` — "Prevent cache corruption during menu update".
 *
 * ── Status: SKIPPED ─────────────────────────────────────────────────────
 *
 * The behavior this test was supposed to exercise (a `503 menus-updating`
 * response from menu/search/favorites endpoints while a menu update was
 * in flight) no longer exists in production code.
 *
 * The original implementation lived at `server/src/middleware/menu.ts` as
 * `requireNoMenusUpdating`, gated by `isAnyCafeCurrentlyUpdating()` in
 * `server/src/api/cafe/job/update.ts`. Both were deleted in commit
 * `a1be214` ("lotta refactors", 2025-08-16). The current cache strategy
 * (memoize-on-watermark, see `middleware/cache.ts` +
 * `middleware/menu-etag.ts`) replaced the lock — readers no longer block
 * on writes, they just get the previous cached response until
 * `menuPublished` invalidates it. There is also no in-process flag we
 * can observe and no 503 path to assert against.
 *
 * Writing a test against the 503 contract would require either:
 *   - Resurrecting the deleted middleware (out of scope; a behavior change,
 *     not a test), or
 *   - Adding a new "is updating" flag to `DailyCafeUpdateSession` and a new
 *     middleware to surface it — also a behavior change, not a test.
 *
 * Coverage of the replacement (watermark-based invalidation) already exists
 * in `etag.test.ts`. If the lock contract is ever re-introduced, this file
 * should be replaced with a real test.
 */

import { test } from 'node:test';

test('menu-update lock is no longer present in production code (skipped)', { skip: 'Behavior removed in commit a1be214 — see file header.' }, () => {});
