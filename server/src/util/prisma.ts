import { Prisma } from '@prisma/client';

export const isUniqueConstraintFailedError = (error: unknown): boolean => {
    // https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}