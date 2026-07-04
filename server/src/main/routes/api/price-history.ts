import Router from '@koa/router';
import * as fs from 'node:fs/promises';
import { IPriceHistoryResponse } from '@msdining/common/models/price-history';
import { attachRouter } from '../../util/koa.js';
import { RouteBuilder } from '../../../shared/models/koa.js';
import { priceHistoryJsonPath } from '../../../shared/constants/config.js';
import { EMPTY_PRICE_HISTORY, readPriceHistoryFileAsync } from '../../../worker/data/price-history/read.js';

let cached: { mtimeMs: number; data: IPriceHistoryResponse } | null = null;

// Serve the precomputed blob, re-reading from disk only when it changes.
const getPriceHistoryAsync = async (): Promise<IPriceHistoryResponse> => {
    let mtimeMs: number;
    try {
        mtimeMs = (await fs.stat(priceHistoryJsonPath)).mtimeMs;
    } catch {
        return EMPTY_PRICE_HISTORY;
    }

    if (cached != null && cached.mtimeMs === mtimeMs) {
        return cached.data;
    }

    const data = await readPriceHistoryFileAsync();
    cached = { mtimeMs, data };
    return data;
};

export const registerPriceHistoryRoutes: RouteBuilder = (parent) => {
    const router = new Router({
        prefix: '/price-history'
    });

    router.get('/', async ctx => {
        ctx.body = await getPriceHistoryAsync();
    });

    attachRouter(parent, router);
};
