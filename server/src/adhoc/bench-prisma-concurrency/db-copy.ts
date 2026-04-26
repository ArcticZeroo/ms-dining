import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SQLITE_SIDECARS = ['-wal', '-shm', '-journal'];

export interface CopiedDb {
    path: string;
    url:  string;
    cleanup: () => void;
}

export const copyDatabase = (sourceDb: string): CopiedDb => {
    if (!fs.existsSync(sourceDb)) {
        throw new Error(`Source DB not found: ${sourceDb}`);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-prisma-'));
    const targetDb = path.join(tmpDir, 'dining.db');

    fs.copyFileSync(sourceDb, targetDb);

    for (const suffix of SQLITE_SIDECARS) {
        const sidecar = sourceDb + suffix;
        if (fs.existsSync(sidecar)) {
            fs.copyFileSync(sidecar, targetDb + suffix);
        }
    }

    // Prisma SQLite URL: forward slashes work on Windows.
    const url = `file:${targetDb.replace(/\\/g, '/')}`;

    return {
        path:    targetDb,
        url,
        cleanup: () => {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
                // best-effort
            }
        }
    };
};
