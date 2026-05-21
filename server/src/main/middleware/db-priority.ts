import Koa from 'koa';
import { runWithDbPriority } from '../../worker/data/storage/db-context.js';

export const dbPriorityMiddleware: Koa.Middleware = (ctx, next) => {
    return runWithDbPriority('normal', () => next());
};
