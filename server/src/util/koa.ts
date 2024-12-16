import Router from '@koa/router';
import Koa from 'koa';
import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/dist/constants/versions.js';

export const attachRouter = (parent: Koa | Router, child: Router) => parent.use(child.routes(), child.allowedMethods());

export const getTrimmedQueryParam = (ctx: Koa.Context, key: string): string | undefined => {
    const value = ctx.query[key];

    if (!value || typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue || undefined;
}

const parseVersionTag = (ctx: Koa.Context) => {
    const tagRaw = ctx.get(VERSION_TAG_HEADER);

    if (tagRaw) {
        const tag = Number(tagRaw);
        if (!Number.isNaN(tag)) {
            return tag;
        }
    }

    return VERSION_TAG.unknown;
}

export const getVersionTag = (ctx: Koa.Context): number => {
    if (typeof ctx.state.versionTag !== 'number' || Number.isNaN(ctx.state.versionTag)) {
        ctx.state.versionTag = parseVersionTag(ctx);
    }

    return ctx.state.versionTag;
}

export const supportsVersionTag = (ctx: Koa.Context, tag: number) => getVersionTag(ctx) >= tag;