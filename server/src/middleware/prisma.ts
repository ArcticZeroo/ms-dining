import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Middleware } from 'koa';

export const treatPrismaNotFoundAs404 = (body: unknown): Middleware => async (ctx, next) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
			ctx.status = 404;
			ctx.body = body;
		}
	}
}