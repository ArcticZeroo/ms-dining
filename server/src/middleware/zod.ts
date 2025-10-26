import { Middleware } from 'koa';
import { ZodError } from 'zod';

export const treatZodErrorsAsBadRequest: Middleware = (ctx, next) => {
	try {
		return next();
	} catch (err) {
		if (err instanceof ZodError) {
			ctx.throw(400, `Invalid request: ${err.message}`);
		}

		throw err;
	}
}