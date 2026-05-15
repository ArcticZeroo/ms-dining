import { PrismaClient } from '@prisma/client';
import * as runtime from '@prisma/client/runtime/library.js';

export type PrismaTransactionClient = Omit<PrismaClient, runtime.ITXClientDenyList>;
export type PrismaLikeClient = PrismaClient | PrismaTransactionClient;

// Methods on model delegates that perform writes.
type DelegateWriteMethods =
    | 'create' | 'createMany' | 'createManyAndReturn'
    | 'update' | 'updateMany' | 'updateManyAndReturn'
    | 'upsert'
    | 'delete' | 'deleteMany';

// Top-level PrismaClient methods that perform writes or should not be used
// through the read path.
type TopLevelWriteMethods =
    | '$executeRaw' | '$executeRawUnsafe'
    | '$transaction';

/**
 * A PrismaClient where every model delegate has write methods stripped and
 * top-level write helpers ($executeRaw, $transaction) are removed. Use with
 * `usePrismaClient` to get compile-time enforcement that the read path
 * never performs writes.
 */
export type ReadOnlyPrismaClient = Omit<{
    [K in keyof PrismaClient]: PrismaClient[K] extends { findMany: any }
        ? Omit<PrismaClient[K], DelegateWriteMethods>
        : PrismaClient[K];
}, TopLevelWriteMethods>;