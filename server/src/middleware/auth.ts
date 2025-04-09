import Koa from 'koa';

export const requireAuthenticated: Koa.Middleware = async (ctx, next) => {
	if (!ctx.isAuthenticated()) {
		ctx.throw(401, 'Unauthorized');
		return;
	}

	await next();
}

export const requireNotAuthenticated: Koa.Middleware = async (ctx, next) => {
	if (ctx.isAuthenticated()) {
		ctx.redirect('/');
		return;
	}

	return next();
}