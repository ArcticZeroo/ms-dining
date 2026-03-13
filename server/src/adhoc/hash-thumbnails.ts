import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath } from '../constants/config.js';
import { updateThumbnailHashFromExistingImage } from '../api/cafe/image/thumbnail.js';
import { saveManifest } from '../api/cafe/image/manifest.js';

console.log('Scanning existing thumbnails and computing dHash values...');
console.log(`Thumbnail directory: ${serverMenuItemThumbnailPath}`);

let files: string[];
try {
    files = await fs.readdir(serverMenuItemThumbnailPath);
} catch {
    console.error('Thumbnail directory does not exist or is not readable.');
    process.exit(1);
}

const pngFiles = files.filter(f => f.endsWith('.png'));
console.log(`Found ${pngFiles.length} PNG thumbnails.`);

const hashToIds = new Map<string, string[]>();
let processed = 0;
let errors = 0;

for (const file of pngFiles) {
    const id = file.replace('.png', '');
    const filePath = path.join(serverMenuItemThumbnailPath, file);

    try {
        const hash = await updateThumbnailHashFromExistingImage(id, filePath);

        // Track duplicates
        const existing = hashToIds.get(hash) ?? [];
        existing.push(id);
        hashToIds.set(hash, existing);

        processed++;
        if (processed % 100 === 0) {
            console.log(`  Processed ${processed}/${pngFiles.length}...`);
        }
    } catch (err) {
        errors++;
        console.error(`  Error processing ${file}:`, err instanceof Error ? err.message : err);
    }
}

// Save manifest
await saveManifest();

// Report results
console.log(`\n=== Results ===`);
console.log(`Processed: ${processed}`);
console.log(`Errors: ${errors}`);
console.log(`Unique hashes: ${hashToIds.size}`);

const duplicateGroups = Array.from(hashToIds.entries()).filter(([, ids]) => ids.length > 1);
console.log(`Duplicate groups (same hash): ${duplicateGroups.length}`);

if (duplicateGroups.length > 0) {
    const totalDuplicateItems = duplicateGroups.reduce((sum, [, ids]) => sum + ids.length, 0);
    const savingsCount = totalDuplicateItems - duplicateGroups.length;
    console.log(`Total items in duplicate groups: ${totalDuplicateItems}`);
    console.log(`Potential file savings: ${savingsCount} thumbnails`);

    console.log('\nTop 10 duplicate groups:');
    duplicateGroups
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 10)
        .forEach(([hash, ids]) => {
            console.log(`  Hash ${hash}: ${ids.length} items (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''})`);
        });
}

console.log('\nDone.');
