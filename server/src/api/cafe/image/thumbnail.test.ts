/**
 * Tests for the thumbnail subsystem — commits 8ef6826 ("fix always
 * downloading thumbnail") and c7aeef8 ("Fix problem with thumbnails not
 * updating over time").
 *
 * ⚠️  Honest scope note: the actual cache-staleness logic targeted by
 * those two commits lives in api/worker-thread/thumbnail.ts inside the
 * file-scoped (non-exported) `getThumbnailData` function. It runs as a
 * Worker thread command handler (THUMBNAIL_THREAD_HANDLER). Driving it
 * end-to-end requires (a) spawning a real Worker thread (which executes
 * loadExistingThumbnailsOnBoot against the on-disk production thumbnail
 * directory at module load — off-limits) and (b) intercepting the global
 * fetch() call that loadImageData makes. Neither seam exists today
 * without modifying production code.
 *
 * So the regression coverage for 8ef6826 / c7aeef8 is currently *not*
 * exercised by any test in this file — the it.skip() blocks at the bottom
 * are TODO markers that should be filled in if/when a pure cache-check
 * helper (e.g. an exported `isThumbnailUpToDate(metadata, lastUpdateTime)`)
 * gets factored out.
 *
 * What we DO test below:
 *   - computeDHash determinism (same image → same hash; different images
 *     → different hashes; output shape). This locks in the perceptual
 *     hash the cache-up-to-date check would eventually compare against,
 *     so a future regression that scrambles dHash output is caught.
 *   - getThumbnailFilepath / getHashThumbnailFilepath path shape.
 *
 * Manifest CRUD tests were moved to ./manifest.test.ts — they don't
 * cover c7aeef8 / 8ef6826, so co-locating them here was misleading about
 * the regression coverage this file delivers.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import Jimp from 'jimp';
import { serverMenuItemThumbnailPath, serverThumbnailPath } from '../../../constants/config.js';
import {
    computeDHash,
    getHashThumbnailFilepath,
    getThumbnailFilepath,
} from './thumbnail.js';

// --- helpers ---------------------------------------------------------

/**
 * Builds a small in-memory Jimp image filled with a simple horizontal
 * gradient seeded by `seed`. Different seeds → visually different images
 * → different dHashes.
 */
const buildImage = async (width: number, height: number, seed: number): Promise<Jimp> => {
    const image = await Jimp.create(width, height, 0xffffffff);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Deterministic per-pixel color driven by (x, y, seed).
            const r = (x * 7 + seed * 13) & 0xff;
            const g = (y * 11 + seed * 17) & 0xff;
            const b = ((x + y) * 5 + seed * 19) & 0xff;
            // Hex 0xRRGGBBAA with full alpha.
            const color = (r << 24) | (g << 16) | (b << 8) | 0xff;
            image.setPixelColor(color >>> 0, x, y);
        }
    }
    return image;
};

// --- tests -----------------------------------------------------------

describe('computeDHash — perceptual stability', () => {
    it('returns the same hash for the same image content', async () => {
        const a = await buildImage(64, 48, 1);
        const b = await buildImage(64, 48, 1);
        assert.equal(computeDHash(a), computeDHash(b),
            'identical pixel content must produce identical hashes');
    });

    it('returns the same hash when run twice against the same image instance', async () => {
        // computeDHash clones internally, so repeated calls against the
        // same image must remain deterministic.
        const img = await buildImage(64, 48, 2);
        const first = computeDHash(img);
        const second = computeDHash(img);
        assert.equal(first, second);
    });

    it('returns different hashes for substantially different images', async () => {
        const a = await buildImage(64, 48, 1);
        const b = await buildImage(64, 48, 99);
        assert.notEqual(computeDHash(a), computeDHash(b),
            'a different gradient seed should perturb enough pixels to flip the dHash');
    });

    it('produces a 16-character hex string (64 bits)', async () => {
        const img = await buildImage(64, 48, 3);
        const hash = computeDHash(img);
        assert.equal(hash.length, 16, `dHash should be 16 hex chars, got "${hash}"`);
        assert.match(hash, /^[0-9a-f]{16}$/, 'dHash should be lowercase hex');
    });
});

describe('thumbnail path helpers', () => {
    it('getThumbnailFilepath joins the menu-item thumbnail dir with <id>.png', () => {
        const expected = path.join(serverMenuItemThumbnailPath, 'abc123.png');
        assert.equal(getThumbnailFilepath('abc123'), expected);
    });

    it('getHashThumbnailFilepath joins the dedup thumbnail dir with <hash>.png', () => {
        const expected = path.join(serverThumbnailPath, 'deadbeef00000000.png');
        assert.equal(getHashThumbnailFilepath('deadbeef00000000'), expected);
    });

    it('the two helpers route to distinct directories', () => {
        // Important for the dedup story: id-keyed thumbnails (backward
        // compat) live separately from hash-keyed thumbnails (newer
        // canonical dedup map). Same filename in different dirs.
        const idPath = getThumbnailFilepath('shared');
        const hashPath = getHashThumbnailFilepath('shared');
        assert.notEqual(idPath, hashPath);
    });
});

// Manifest CRUD assertions moved to ./manifest.test.ts — they're unrelated
// to the c7aeef8 / 8ef6826 cache-staleness regressions documented above.

// ---------------------------------------------------------------------
// Skipped: cache-staleness regressions for 8ef6826 + c7aeef8.
// ---------------------------------------------------------------------
//
// These tests would pin the actual fix points but require either a
// refactor that exposes the cache-up-to-date helper, or test seams for
// global fetch() + the Worker-thread boundary. Documented here so a
// future cleanup can drop the `.skip` and fill in the assertions.

describe('cache-staleness behavior (api/worker-thread/thumbnail.ts:getThumbnailData)', () => {
    it.skip('reuses cached metadata when cached lastUpdateTime >= source lastUpdateTime', () => {
        // Regression for 8ef6826. Currently untestable because:
        //   - getThumbnailData is not exported (it's wrapped by
        //     THUMBNAIL_THREAD_HANDLER), and
        //   - the cache-hit path in worker-thread/thumbnail.ts requires
        //     the Worker-thread module's private `thumbnailDataByMenuItemId`
        //     map to be pre-populated.
        // Exposing `isThumbnailUpToDate(metadata, sourceLastUpdateTime)`
        // as a pure helper would let us test this without spinning a
        // Worker.
    });

    it.skip('regenerates the thumbnail when the source is newer than the cached copy', () => {
        // Regression for c7aeef8. Same blocker — needs a pure helper or
        // an injectable fetch seam to assert that loadImageData was
        // called for the stale source.
    });

    it.skip('forces re-download when the request carries no lastUpdateTime', () => {
        // Regression for 8ef6826 — pre-fix, missing lastUpdateTime caused
        // the cache check to silently return cached metadata in some
        // arrangements. Same testability blocker.
    });
});
