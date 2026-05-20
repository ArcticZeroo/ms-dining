import Koa from 'koa';
import fsPromises from 'node:fs/promises';
import Duration from '@arcticzeroo/duration';

const DEFAULT_CACHE_EXPIRATION_TIME = new Duration({ minutes: 30 });

interface ICacheData {
    expirationTime: number;
    body: string;
    contentLength: string;
}

export const serveSpaHtmlRoute = (filePath: string): Koa.Middleware => {
    let cacheData: ICacheData | undefined;

    return async ctx => {
        if (cacheData == null || Date.now() > cacheData.expirationTime) {
            const [fileContents, stats] = await Promise.all([
                fsPromises.readFile(filePath, 'utf8'),
                fsPromises.stat(filePath)
            ]);

            cacheData = {
                expirationTime: Date.now() + DEFAULT_CACHE_EXPIRATION_TIME.inMilliseconds,
                body:           fileContents,
                contentLength:  stats.size.toString()
            };
        }

        ctx.type = 'html';
        ctx.set('Content-Length', cacheData.contentLength);
        ctx.body = cacheData.body;
    };
}