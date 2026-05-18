/**
 * Tests for the in-memory thumbnail manifest helpers.
 *
 * These tests cover updateManifestEntry / removeManifestEntry / getManifest
 * — the pure in-memory state operations on the module-level `manifest`
 * map. loadManifest / saveManifest are intentionally not exercised here
 * because they touch the real production thumbnail directory.
 *
 * (Moved out of thumbnail.test.ts: those operations are unrelated to the
 * regressions claimed by that file's header — c7aeef8 and 8ef6826 are
 * about cache-staleness, not manifest CRUD.)
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    getManifest,
    removeManifestEntry,
    updateManifestEntry,
} from './manifest.js';

describe('manifest in-memory state', () => {
    it('updateManifestEntry stores the entry under the given id', () => {
        const id = `test-${process.pid}-${Date.now()}-A`;
        const entry = {
            hash:           'abc1234567890def',
            width:          200,
            height:         150,
            lastUpdateTime: '2026-05-13T12:00:00.000Z',
        };
        updateManifestEntry(id, entry);
        const stored = getManifest()[id];
        assert.ok(stored);
        assert.deepEqual(stored, entry);
        // Cleanup so we don't leave manifest state lying around for sibling tests.
        removeManifestEntry(id);
    });

    it('removeManifestEntry deletes the entry', () => {
        const id = `test-${process.pid}-${Date.now()}-B`;
        updateManifestEntry(id, {
            hash:           '0000000000000000',
            width:          1,
            height:         1,
            lastUpdateTime: new Date(0).toISOString(),
        });
        assert.ok(getManifest()[id], 'entry should be present after update');
        removeManifestEntry(id);
        assert.equal(getManifest()[id], undefined, 'entry should be gone after remove');
    });

    it('updateManifestEntry overwrites prior data for the same id', () => {
        const id = `test-${process.pid}-${Date.now()}-C`;
        updateManifestEntry(id, {
            hash:           'aaaaaaaaaaaaaaaa',
            width:          100,
            height:         100,
            lastUpdateTime: '2020-01-01T00:00:00.000Z',
        });
        updateManifestEntry(id, {
            hash:           'bbbbbbbbbbbbbbbb',
            width:          200,
            height:         200,
            lastUpdateTime: '2026-01-01T00:00:00.000Z',
        });

        const current = getManifest()[id];
        assert.ok(current);
        assert.equal(current.hash, 'bbbbbbbbbbbbbbbb');
        assert.equal(current.width, 200);
        assert.equal(current.lastUpdateTime, '2026-01-01T00:00:00.000Z');

        removeManifestEntry(id);
    });
});
