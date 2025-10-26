import { PrismaClient } from '@prisma/client';
import * as runtime from '@prisma/client/runtime/library.js';

export type PrismaTransactionClient = Omit<PrismaClient, runtime.ITXClientDenyList>;
export type PrismaLikeClient = PrismaClient | PrismaTransactionClient;