import Duration from '@arcticzeroo/duration';
import { isDuckType } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import { DISPLAY_NAME_MAX_LENGTH_CHARS, IClientUserDTO } from '@msdining/common/dist/models/auth.js';
import { normalizeDisplayName } from '@msdining/common/dist/util/string-util.js';
import { Middleware } from 'koa';
import passport from 'koa-passport';
import { UserStorageClient } from '../../api/storage/clients/user.js';
import { hasAuthEnvironmentVariables } from '../../constants/env.js';
import { requireAuthenticated, requireNotAuthenticated } from '../../middleware/auth.js';
import { assignCacheControlMiddleware } from '../../middleware/cache.js';
import { getGoogleStrategy, getMicrosoftStrategy } from '../../passport/strategies.js';
import { attachRouter, getUserIdOrThrow, getUserOrThrowAsync } from '../../util/koa.js';
import { logInfo } from '../../util/log.js';
import { isUpdateUserSettingsInput } from '../../util/typeguard.js';

const isAuthorizationError = (err: unknown) => {
    return err instanceof Error && err.constructor.name === 'AuthorizationError';
};

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
    };

    passport.serializeUser(idOnlyTransform);
    passport.deserializeUser(idOnlyTransform);

    passport.use(getMicrosoftStrategy());
    passport.use(getGoogleStrategy());

    const catchAuthorizationErrorMiddleware: Middleware = async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            if (!isAuthorizationError(err)) {
                throw err;
            } else {
                if (!ctx.headerSent) {
                    ctx.redirect('/login');
                }
            }
        }
    }

    router.get('/microsoft/login',
        requireNotAuthenticated,
        catchAuthorizationErrorMiddleware,
        passport.authenticate('microsoft', {
            prompt:          'select_account',
            failureRedirect: '/login'
        }));

    router.get('/google/login',
        requireNotAuthenticated,
        catchAuthorizationErrorMiddleware,
        passport.authenticate('google', {
            failureRedirect: '/login'
        }));

    // In my personal testing, I found that the PWA being installed on the phone means that we double-complete the
    // auth callback sometimes, which leads to an internal passport error which for some reason doesn't redirect
    // to a failure page. Instead, I think it should help to just check if we're already authed before asking passport
    // to do the auth step.
    router.get('/microsoft/callback',
        requireNotAuthenticated,
        catchAuthorizationErrorMiddleware,
        passport.authenticate('microsoft', {
            failureRedirect: '/login',
            successRedirect: '/'
        }));

    router.get('/google/callback',
        requireNotAuthenticated,
        catchAuthorizationErrorMiddleware,
        passport.authenticate('google', {
            failureRedirect: '/login',
            successRedirect: '/'
        }));

    router.get('/me',
        requireAuthenticated,
        assignCacheControlMiddleware(new Duration({ minutes: 1 }), false /*isPublic*/),
        async ctx => {
            const user = await getUserOrThrowAsync(ctx);

            ctx.body = {
                id:          user.id,
                displayName: user.displayName,
                provider:    user.provider,
                createdAt:   user.createdAt.getTime(),
            } satisfies IClientUserDTO;
        });

    router.patch('/me/name',
        requireAuthenticated,
        async ctx => {
            const id = getUserIdOrThrow(ctx);

            const body = ctx.request.body;
            if (!isDuckType<{ displayName: string }>(body, { displayName: 'string' })) {
                ctx.throw(400, 'Invalid name');
                return;
            }

            const { displayName } = body;

            const normalizedDisplayName = normalizeDisplayName(displayName);

            if (normalizedDisplayName.length > DISPLAY_NAME_MAX_LENGTH_CHARS) {
                ctx.throw(400, 'Name too long');
                return;
            }

            await UserStorageClient.updateUserDisplayNameAsync(id, normalizedDisplayName);
            ctx.status = 204;
        });

    router.patch(
        '/me/settings',
        requireAuthenticated,
        async ctx => {
            const id = getUserIdOrThrow(ctx);

            const body = ctx.request.body;
            if (!isUpdateUserSettingsInput(body)) {
                ctx.throw(400, 'Invalid settings');
                return;
            }

            await UserStorageClient.updateUserSettingsAsync(id, {
                favoriteMenuItems: body.favoriteMenuItems,
                favoriteStations:  body.favoriteStations,
                homepageIds:       body.homepageIds,
                timestamp:         body.timestamp,
            });

            ctx.status = 204;
        });

    router.get('/logout', async ctx => {
        await ctx.logout();
        ctx.redirect('/');
    });

    attachRouter(parent, router);
};