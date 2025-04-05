import Router from '@koa/router';
import { attachRouter } from '../../util/koa.js';
import passport from 'koa-passport';
import { hasAuthEnvironmentVariables } from '../../constants/env.js';
import { logInfo } from '../../util/log.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { UserStorageClient } from '../../api/storage/clients/user.js';
import { requireAuthenticated } from '../../middleware/auth.js';
import { DISPLAY_NAME_MAX_LENGTH_CHARS, IClientUserDTO } from '@msdining/common/dist/models/auth.js';
import { getGoogleStrategy, getMicrosoftStrategy } from '../../passport/strategies.js';

export const registerAuthRoutes = (parent: Router) => {
	if (!hasAuthEnvironmentVariables()) {
		logInfo('Auth environment variables not set, skipping auth routes');
		return;
	}

	const router = new Router({
		prefix: '/auth'
	});

	const idOnlyTransform = (id: unknown, done: (error: Error | null, email?: string) => void) => {
		if (typeof id !== 'string') {
			done(new Error('Invalid user id type'));
			return;
		}

		done(null, id);
	}

	passport.serializeUser(idOnlyTransform);
	passport.deserializeUser(idOnlyTransform);

	passport.use(getMicrosoftStrategy());
	passport.use(getGoogleStrategy());

	router.get('/microsoft/login', passport.authenticate('microsoft', {
		prompt:          'select_account',
		failureRedirect: '/login'
	}));

	router.get('/google/login', passport.authenticate('google', {
		failureRedirect: '/login'
	}));

	router.get('/microsoft/callback',
		passport.authenticate('microsoft', { failureRedirect: '/login' }),
		async ctx => {
			// Successful authentication, redirect home.
			ctx.redirect('/');
		});

	router.get('/google/callback',
		passport.authenticate('google', { failureRedirect: '/login' }),
		async ctx => {
			// Successful authentication, redirect home.
			ctx.redirect('/');
		});

	router.get('/me', requireAuthenticated, async ctx => {
		const id = ctx.state.user;

		if (!id || typeof id !== 'string') {
			ctx.throw(500, 'User not found in session');
			return;
		}

		const user = await UserStorageClient.getUserAsync({ id });
		if (!user) {
			ctx.throw(500, 'User not found');
			return;
		}

		ctx.body = {
			id: user.id,
			displayName: user.displayName,
			provider: user.provider,
			createdAt: user.createdAt.getTime(),
		} satisfies IClientUserDTO;
	});

	router.patch('/me/name', requireAuthenticated, async ctx => {
		const id = ctx.state.user;

		if (!id || typeof id !== 'string') {
			ctx.throw(500, 'User not found in session');
			return;
		}

		const body = ctx.request.body;
		if (!isDuckType<{ displayName: string }>(body, { displayName: 'string' })) {
			ctx.throw(400, 'Invalid name');
			return;
		}

		const { displayName } = body;

		if (displayName.length > DISPLAY_NAME_MAX_LENGTH_CHARS) {
			ctx.throw(400, 'Name too long');
			return;
		}

		await UserStorageClient.updateUserDisplayNameAsync(id, displayName);
		ctx.status = 204;
	});

	router.get('/logout', async ctx => {
		await ctx.logout();
		ctx.redirect('/');
	});

	attachRouter(parent, router);
}