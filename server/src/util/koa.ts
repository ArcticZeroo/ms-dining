import Router from '@koa/router';
import Koa from 'koa';

export const attachRouter = (parent: Router, child: Router) => parent.use(child.routes(), child.allowedMethods());

export const getTrimmedQueryParam = (ctx: Koa.Context, key: string): string | undefined => {
	const value = ctx.query[key];

	if (!value || typeof value !== 'string') {
		return undefined;
	}

	const trimmedValue = value.trim();
	return trimmedValue || undefined;
}