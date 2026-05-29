/**
 * Post-build cleanup: removes hashed asset files from dist/assets/
 * that are older than MAX_AGE_DAYS. Keeps recent files around so
 * stale tabs can still load old chunks after a deploy.
 *
 * Run after `vite build` (which now has emptyOutDir: false).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Duration from '@arcticzeroo/duration';

const MAX_AGE = new Duration({ days: 14 });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
    process.exit(0);
}

const now = Date.now();
let removedCount = 0;

for (const file of fs.readdirSync(assetsDir)) {
    const filePath = path.join(assetsDir, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > MAX_AGE.inMilliseconds) {
        fs.unlinkSync(filePath);
        removedCount++;
    }
}

if (removedCount > 0) {
    console.log(`[cleanup-assets] Removed ${removedCount} asset(s) older than ${MAX_AGE.inDays} days`);
}