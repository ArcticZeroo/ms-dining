/**
 * Post-build cleanup of stale hashed assets in dist/assets/.
 *
 * Assets are emitted as `[name]-[hash].[ext]` with emptyOutDir:false (see
 * vite.config.ts), so old hashed versions pile up across deploys. We keep them
 * around so users on a stale tab can still load old chunks, then prune them
 * once they've been *superseded* long enough for users to migrate to a newer
 * build (MIGRATION_WINDOW).
 *
 * The window must run from when an asset was SUPERSEDED, not from when it was
 * built or how old the file is on disk. A build can sit live for months; the
 * moment a newer build replaces it, its users still need a full window to
 * migrate. mtimes/sibling hashes can't express that (and builds can be far
 * apart), so the only component that knows the supersession moment is the
 * build that drops the asset — we record it in a ledger.
 *
 * This file is just the I/O shell: it reads the Vite build manifest (for
 * liveness), the persisted orphan ledger, and the asset list, then defers the
 * actual decision to the pure, unit-tested logic in
 * cleanup-stale-assets-core.ts.
 *
 * Run after `vite build`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Duration from '@arcticzeroo/duration';
import {
    AssetCleanupLedger,
    collectLiveAssetNames,
    IManifestChunk,
    planAssetCleanup
} from './cleanup-stale-assets-core.ts';

const MIGRATION_WINDOW = new Duration({ days: 7 });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(distDir, 'assets');
const viteMetaDir = path.join(distDir, '.vite');
const manifestPath = path.join(viteMetaDir, 'manifest.json');
const ledgerPath = path.join(viteMetaDir, 'asset-cleanup-ledger.json');

if (!fs.existsSync(assetsDir)) {
    process.exit(0);
}

// Without the manifest we can't tell live assets from removed ones, so it
// isn't safe to delete anything — bail out rather than risk pruning assets the
// current build still references.
if (!fs.existsSync(manifestPath)) {
    console.warn('[cleanup-assets] No build manifest found; skipping cleanup');
    process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, IManifestChunk>;
const liveAssetNames = collectLiveAssetNames({ manifest, distDir, assetsDir });

let previousLedger: AssetCleanupLedger = {};
if (fs.existsSync(ledgerPath)) {
    try {
        previousLedger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as AssetCleanupLedger;
    } catch {
        // Corrupt/old ledger — start fresh. Worst case every current orphan
        // gets a fresh window, which is safe (conservative).
        previousLedger = {};
    }
}

const { toDelete, nextLedger } = planAssetCleanup({
    liveAssetNames,
    existingAssetNames: fs.readdirSync(assetsDir),
    previousLedger,
    now:                Date.now(),
    windowMs:           MIGRATION_WINDOW.inMilliseconds
});

for (const assetName of toDelete) {
    fs.unlinkSync(path.join(assetsDir, assetName));
}

fs.writeFileSync(ledgerPath, JSON.stringify(nextLedger));

if (toDelete.length > 0) {
    console.log(`[cleanup-assets] Removed ${toDelete.length} asset(s) orphaned for more than ${MIGRATION_WINDOW.inDays} days`);
}