/**
 * Tests for the thumbnail subsystem.
 *
 * Coverage:
 *   - computeDHash determinism (same image → same hash; different images
 *     → different hashes; output shape).
 *   - getThumbnailFilepath / getHashThumbnailFilepath path shape.
 *   - processImageToThumbnail on large images (regression for OOM with
 *     jpeg-js / Jimp on high-resolution JPEGs).
 *   - isThumbnailUpToDate cache-staleness logic (regressions for 8ef6826
 *     and c7aeef8).
 *
 * Manifest CRUD tests live in ./manifest.test.ts.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import sharp from 'sharp';
import { serverMenuItemThumbnailPath, serverThumbnailPath } from '../../../../shared/constants/config.js';
import {
    computeDHash,
    getHashThumbnailFilepath,
    getThumbnailFilepath,
    processImageToThumbnail,
} from './thumbnail.js';
import { isThumbnailUpToDate } from '../../../data/threads/thumbnail.js';

// --- helpers ---------------------------------------------------------

/**
 * Builds a small in-memory PNG buffer filled with a simple horizontal
 * gradient seeded by `seed`. Different seeds → visually different images
 * → different dHashes.
 */
const buildImage = async (width: number, height: number, seed: number): Promise<Buffer> => {
    const channels = 3;
    const pixels = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * channels;
            pixels[offset]     = (x * 7 + seed * 13) & 0xff;
            pixels[offset + 1] = (y * 11 + seed * 17) & 0xff;
            pixels[offset + 2] = ((x + y) * 5 + seed * 19) & 0xff;
        }
    }
    return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
};

// --- tests -----------------------------------------------------------

describe('computeDHash — perceptual stability', () => {
    it('returns the same hash for the same image content', async () => {
        const a = await buildImage(64, 48, 1);
        const b = await buildImage(64, 48, 1);
        assert.equal(await computeDHash(a), await computeDHash(b),
            'identical pixel content must produce identical hashes');
    });

    it('returns the same hash when run twice against the same buffer', async () => {
        const img = await buildImage(64, 48, 2);
        const first = await computeDHash(img);
        const second = await computeDHash(img);
        assert.equal(first, second);
    });

    it('returns different hashes for substantially different images', async () => {
        const a = await buildImage(64, 48, 1);
        const b = await buildImage(64, 48, 99);
        assert.notEqual(await computeDHash(a), await computeDHash(b),
            'a different gradient seed should perturb enough pixels to flip the dHash');
    });

    it('produces a 16-character hex string (64 bits)', async () => {
        const img = await buildImage(64, 48, 3);
        const hash = await computeDHash(img);
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

describe('large image handling', () => {
    // Regression: a 8256×5504 JPEG caused jpeg-js (used by Jimp) to exceed
    // its 512MB memory limit. sharp handles this via DCT shrink-on-load.
    // We use 4000×3000 here to keep test memory reasonable while still being
    // large enough to have caused OOM under the old Jimp implementation.
    it('processImageToThumbnail succeeds on a large JPEG without OOM', async () => {
        const width = 4000;
        const height = 3000;
        const channels = 3;
        const pixels = Buffer.alloc(width * height * channels);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = (i * 7) & 0xff;
        }

        const jpegBuffer = await sharp(pixels, { raw: { width, height, channels } })
            .jpeg({ quality: 50 })
            .toBuffer();

        const result = await processImageToThumbnail(jpegBuffer);

        assert.equal(result.hash.length, 16);
        assert.match(result.hash, /^[0-9a-f]{16}$/);
        assert.ok(result.width <= 400, `thumbnail width ${result.width} exceeds 400`);
        assert.ok(result.height <= 200, `thumbnail height ${result.height} exceeds 200`);
        assert.ok(result.pngBuffer.length > 0, 'should produce a non-empty PNG');
    });
});

// Manifest CRUD assertions live in ./manifest.test.ts.

describe('isThumbnailUpToDate — cache-staleness logic', () => {
    it('returns true when cached lastUpdateTime >= source lastUpdateTime', () => {
        const cached = new Date('2024-06-01T12:00:00Z');
        const source = new Date('2024-05-01T12:00:00Z');
        assert.equal(isThumbnailUpToDate(cached, source), true);
    });

    it('returns true when cached and source lastUpdateTime are equal', () => {
        const time = new Date('2024-06-01T12:00:00Z');
        assert.equal(isThumbnailUpToDate(time, new Date(time.getTime())), true);
    });

    it('returns false when the source is newer than the cached copy', () => {
        const cached = new Date('2024-05-01T12:00:00Z');
        const source = new Date('2024-06-01T12:00:00Z');
        assert.equal(isThumbnailUpToDate(cached, source), false);
    });

    it('returns true when the request carries no lastUpdateTime (null)', () => {
        const cached = new Date('2024-06-01T12:00:00Z');
        assert.equal(isThumbnailUpToDate(cached, null), true);
    });

    it('returns true when the request carries no lastUpdateTime (undefined)', () => {
        const cached = new Date('2024-06-01T12:00:00Z');
        assert.equal(isThumbnailUpToDate(cached, undefined), true);
    });
});
