import * as assert from 'node:assert';
import * as path from 'node:path';
import { describe, it } from 'vitest';
import {
    AssetCleanupLedger,
    collectLiveAssetNames,
    planAssetCleanup
} from '../../scripts/cleanup-stale-assets-core.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 7 * DAY_MS;

const distDir = path.join('/repo', 'client', 'dist');
const assetsDir = path.join(distDir, 'assets');

describe('collectLiveAssetNames', () => {
    it('collects file, css, and asset entries relative to the assets dir', () => {
        const live = collectLiveAssetNames({
            manifest: {
                'src/index.html': { file: 'assets/index-abc.js', css: ['assets/index-abc.css'] },
                'logo.svg':       { file: 'assets/logo-def.svg' },
                'shared.js':      { file: 'assets/shared-ghi.js', assets: ['assets/font-jkl.woff2'] }
            },
            distDir,
            assetsDir
        });

        assert.deepStrictEqual(
            new Set(live),
            new Set(['index-abc.js', 'index-abc.css', 'logo-def.svg', 'shared-ghi.js', 'font-jkl.woff2'])
        );
    });

    it('ignores referenced files that live outside the assets dir', () => {
        const live = collectLiveAssetNames({
            manifest:  { 'src/index.html': { file: 'index.html', css: ['assets/index-abc.css'] } },
            distDir,
            assetsDir
        });

        assert.deepStrictEqual(new Set(live), new Set(['index-abc.css']));
    });
});

describe('planAssetCleanup', () => {
    const plan = (
        liveAssetNames: string[],
        existingAssetNames: string[],
        previousLedger: AssetCleanupLedger,
        now: number
    ) => planAssetCleanup({
        liveAssetNames: new Set(liveAssetNames),
        existingAssetNames,
        previousLedger,
        now,
        windowMs:       WINDOW_MS
    });

    it('never deletes or tracks assets referenced by the current build', () => {
        const { toDelete, nextLedger } = plan(
            ['index-live.js', 'index-live.css'],
            ['index-live.js', 'index-live.css'],
            {},
            100 * DAY_MS
        );

        assert.deepStrictEqual(toDelete, []);
        assert.deepStrictEqual(nextLedger, {});
    });

    it('keeps a long-lived asset the moment it is first superseded (the sparse-build case)', () => {
        // Build A shipped at t=0 and sat live for 30 days; build B now replaces
        // it entirely. A is 30 days old on disk but only *just* superseded, so
        // it must NOT be deleted — its clock starts now.
        const now = 30 * DAY_MS;
        const { toDelete, nextLedger } = plan(
            ['index-B.js'],
            ['index-A.js', 'index-B.js'],
            {}, // never seen orphaned before
            now
        );

        assert.deepStrictEqual(toDelete, []);
        assert.deepStrictEqual(nextLedger, { 'index-A.js': now });
    });

    it('carries an orphan forward while it is inside the window', () => {
        const supersededAt = 30 * DAY_MS;
        const now = supersededAt + 3 * DAY_MS;
        const { toDelete, nextLedger } = plan(
            ['index-B.js'],
            ['index-A.js', 'index-B.js'],
            { 'index-A.js': supersededAt },
            now
        );

        assert.deepStrictEqual(toDelete, []);
        assert.deepStrictEqual(nextLedger, { 'index-A.js': supersededAt });
    });

    it('deletes an orphan once its clock exceeds the window', () => {
        const supersededAt = 30 * DAY_MS;
        const now = supersededAt + WINDOW_MS + DAY_MS / 2;
        const { toDelete, nextLedger } = plan(
            ['index-B.js'],
            ['index-A.js', 'index-A.css', 'index-B.js'],
            { 'index-A.js': supersededAt, 'index-A.css': supersededAt },
            now
        );

        assert.deepStrictEqual(toDelete.sort(), ['index-A.css', 'index-A.js']);
        assert.deepStrictEqual(nextLedger, {});
    });

    it('deletes exactly at the window boundary', () => {
        const supersededAt = 10 * DAY_MS;
        const now = supersededAt + WINDOW_MS; // orphanedAt === staleCutoff
        const { toDelete } = plan(['b.js'], ['a.js', 'b.js'], { 'a.js': supersededAt }, now);

        assert.deepStrictEqual(toDelete, ['a.js']);
    });

    it('ages out a fully-removed asset a window after it was dropped', () => {
        // Removed assets have no successor, but are tracked the same way.
        const removedAt = 41 * DAY_MS;

        const justRemoved = plan(['b.js'], ['removed-feature.js', 'b.js'], {}, removedAt);
        assert.deepStrictEqual(justRemoved.toDelete, [], 'kept right after removal');
        assert.deepStrictEqual(justRemoved.nextLedger, { 'removed-feature.js': removedAt });

        const later = plan(
            ['b.js'],
            ['removed-feature.js', 'b.js'],
            justRemoved.nextLedger,
            removedAt + WINDOW_MS + DAY_MS / 2
        );
        assert.deepStrictEqual(later.toDelete, ['removed-feature.js'], 'aged out ~7.5d after removal');
    });

    it('resets the clock when an orphan becomes live again', () => {
        const orphanedAt = 51 * DAY_MS;
        const ledgerWhileOrphaned = { 'd.js': orphanedAt };

        // d.js is referenced again -> dropped from the ledger entirely.
        const liveAgain = plan(['b.js', 'd.js'], ['b.js', 'd.js'], ledgerWhileOrphaned, 55 * DAY_MS);
        assert.strictEqual('d.js' in liveAgain.nextLedger, false);

        // Orphaned a second time much later -> a brand new clock, not the stale one.
        const reorphanedAt = 56 * DAY_MS;
        const reorphaned = plan(['b.js'], ['b.js', 'd.js'], liveAgain.nextLedger, reorphanedAt);
        assert.deepStrictEqual(reorphaned.toDelete, [], 'not deleted on the old timestamp');
        assert.deepStrictEqual(reorphaned.nextLedger, { 'd.js': reorphanedAt });
    });

    it('deletes nothing on the first run, giving every existing orphan a fresh window', () => {
        const now = 100 * DAY_MS;
        const { toDelete, nextLedger } = plan(
            ['live.js'],
            ['live.js', 'old-1.js', 'old-2.js'],
            {}, // no ledger yet
            now
        );

        assert.deepStrictEqual(toDelete, []);
        assert.deepStrictEqual(nextLedger, { 'old-1.js': now, 'old-2.js': now });
    });

    it('drops ledger entries for assets that no longer exist on disk', () => {
        const { nextLedger } = plan(
            ['live.js'],
            ['live.js'], // "ghost.js" is in the ledger but gone from disk
            { 'ghost.js': 10 * DAY_MS },
            20 * DAY_MS
        );

        assert.deepStrictEqual(nextLedger, {});
    });
});
