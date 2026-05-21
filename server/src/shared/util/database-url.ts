import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves a DATABASE_URL `file:` path relative to the `prisma/` directory,
 * which is how Prisma CLI tools interpret the URL. The libsql adapter
 * resolves relative to CWD, so we need to do the resolution ourselves.
 *
 * Non-file URLs (e.g. `libsql://...`) are returned unchanged.
 */
export const resolveDatabaseUrl = (rawUrl: string): string => {
    if (!rawUrl.startsWith('file:')) {
        return rawUrl;
    }

    const relativePath = rawUrl.slice('file:'.length);
    const prismaDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..', '..', 'prisma',
    );
    const resolved = path.resolve(prismaDir, relativePath);
    return `file:${resolved}`;
};
