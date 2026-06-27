/**
 * Pure decision logic for the stale-asset cleanup (see cleanup-stale-assets.ts
 * for the I/O shell and the full rationale).
 *
 * Everything here is side-effect free — no fs, no clock, no process — so it can
 * be unit-tested by passing plain data. The shell is responsible for reading
 * the manifest/ledger/asset list, applying the returned plan, and persisting
 * the next ledger.
 */

import * as path from 'node:path';

export interface IManifestChunk {
    file:    string;
    css?:    string[];
    assets?: string[];
}

export type AssetCleanupLedger = Record<string, number>;

export interface ICollectLiveAssetNamesInput {
    /** Parsed Vite build manifest. */
    manifest:  Record<string, IManifestChunk>;
    /** Absolute path to the build output (dist) directory. */
    distDir:   string;
    /** Absolute path to the assets directory inside dist. */
    assetsDir: string;
}

export interface IPlanAssetCleanupInput {
    /** Asset file names (relative to the assets dir) the current build references. */
    liveAssetNames:     ReadonlySet<string>;
    /** Asset file names currently present in the assets dir. */
    existingAssetNames: readonly string[];
    /** Ledger from the previous run: asset name -> epoch ms first observed orphaned. */
    previousLedger:     Readonly<AssetCleanupLedger>;
    /** Current time, epoch ms. */
    now:                number;
    /** Migration window in ms; an orphan older than this is removed. */
    windowMs:           number;
}

export interface IAssetCleanupPlan {
    /** Asset file names that should be deleted this run. */
    toDelete:   string[];
    /** Ledger to persist for the next run (orphans still inside the window). */
    nextLedger: AssetCleanupLedger;
}

/**
 * Collect the names (relative to `assetsDir`) of every file the current build
 * references, from a parsed Vite manifest. Manifest paths are relative to
 * `distDir` (e.g. "assets/index-abc123.js"); only files that actually live
 * under `assetsDir` are returned.
 */
export const collectLiveAssetNames = (
    { manifest, distDir, assetsDir }: ICollectLiveAssetNamesInput
): Set<string> => {
    const liveAssetNames = new Set<string>();

    for (const chunk of Object.values(manifest)) {
        for (const relativePath of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
            const assetName = path.relative(assetsDir, path.join(distDir, relativePath));
            if (assetName && !assetName.startsWith('..') && !path.isAbsolute(assetName)) {
                liveAssetNames.add(assetName);
            }
        }
    }

    return liveAssetNames;
};

/**
 * Decide which orphaned assets to delete and what the next ledger should be.
 *
 * An asset is "orphaned" when it isn't referenced by the current build. Its
 * migration clock starts the first time it's observed orphaned (recorded as
 * `now`, then carried forward); it's deleted once the clock exceeds the
 * window. Live assets are always kept and never enter the ledger, so the
 * rebuilt `nextLedger` automatically drops entries for assets that became live
 * again or were deleted.
 */
export const planAssetCleanup = (
    {
        liveAssetNames,
        existingAssetNames,
        previousLedger,
        now,
        windowMs
    }: IPlanAssetCleanupInput
): IAssetCleanupPlan => {
    const staleCutoffMs = now - windowMs;
    const toDelete: string[] = [];
    const nextLedger: AssetCleanupLedger = {};

    for (const assetName of existingAssetNames) {
        // Live assets are always kept and never tracked as orphans.
        if (liveAssetNames.has(assetName)) {
            continue;
        }

        // Start the migration clock the first time we see this asset orphaned.
        const orphanedAtMs = previousLedger[assetName] ?? now;

        if (orphanedAtMs <= staleCutoffMs) {
            toDelete.push(assetName);
            continue;
        }

        // Still within the migration window — keep it and carry its clock forward.
        nextLedger[assetName] = orphanedAtMs;
    }

    return { toDelete, nextLedger };
};
