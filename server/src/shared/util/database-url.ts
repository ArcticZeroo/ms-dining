import path from 'node:path';

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
    // Prisma resolves file: URLs relative to the prisma/ directory.
    // Use process.cwd() + prisma/ as the base, since the server is
    // always started from the server/ directory.
    const prismaDir = path.resolve(process.cwd(), 'prisma');
    const resolved = path.resolve(prismaDir, relativePath);
    return `file:${resolved}`;
};
