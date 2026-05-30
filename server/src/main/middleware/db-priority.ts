import Koa from 'koa';
import { runWithDbPriority } from '../../shared/util/db-priority.js';

export const dbPriorityMiddleware: Koa.Middleware = (ctx, next) => {
    return runWithDbPriority('normal', () => next());
};
