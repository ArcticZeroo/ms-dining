import Router from '@koa/router';
import Koa, { Middleware } from 'koa';
import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/constants/versions';
import { IServerSearchResult } from '../models/search.js';
import { ISearchResponseResult } from '@msdining/common/models/http';
import { SearchEntityType, SearchMatchReason } from '@msdining/common/models/search';
import { getStationLogoUrl } from './cafe.js';
import { jsonStringifyWithoutNull } from './serde.js';
import { getDevKey } from '../constants/env.js';
import { UserStorageClient } from '../api/storage/clients/user.js';
import { IServerUser } from '../models/auth.js';
import Duration, { DurationOrMilliseconds } from '@arcticzeroo/duration';

export const attachRouter = (parent: Koa | Router, child: Router) => parent.use(child.routes(), child.allowedMethods());

export const getTrimmedQueryParam = (ctx: Koa.Context, key: string): string | undefined => {
	const value = ctx.query[key];

	if (!value || typeof value !== 'string') {
		return undefined;
	}

	const trimmedValue = value.trim();
	return trimmedValue || undefined;
}

export const getMaybeNumberQueryParam = (ctx: Koa.Context, key: string): number | undefined => {
	const value = ctx.query[key];

	if (!value || typeof value !== 'string') {
		return undefined;
	}

	const numberValue = Number(value);

	if (Number.isNaN(numberValue)) {
		return undefined;
	}

	return numberValue;
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

export const serializeMapOfStringToSet = (deserialized: Map<string, Set<string>>) => {
	const serialized: Record<string /*cafeId*/, Array<string>> = {};
	for (const [cafeId, dates] of deserialized.entries()) {
		serialized[cafeId] = Array.from(dates);
	}
	return serialized;
};

const serializeSearchResult = async (searchResult: IServerSearchResult, allowModifiers: boolean): Promise<ISearchResponseResult> => {
	const matchReasons = new Set(searchResult.matchReasons);
	if (!allowModifiers) {
		matchReasons.delete(SearchMatchReason.modifier);
	}

	const imageUrl = typeof searchResult.imageUrl === 'function'
		? await searchResult.imageUrl()
		: searchResult.imageUrl;

	return ({
		type:             searchResult.type,
		name:             searchResult.name,
		description:      searchResult.description || undefined,
		imageUrl:         getStationLogoUrl(searchResult.name, imageUrl) || undefined,
		locations:        serializeMapOfStringToSet(searchResult.locationDatesByCafeId),
		prices:           Object.fromEntries(searchResult.priceByCafeId),
		stations:         Object.fromEntries(searchResult.stationByCafeId),
		tags:             searchResult.tags ? Array.from(searchResult.tags) : undefined,
		searchTags:       searchResult.searchTags ? Array.from(searchResult.searchTags) : undefined,
		matchedModifiers: allowModifiers ? serializeMapOfStringToSet(searchResult.matchedModifiers) : {},
		matchReasons:     Array.from(matchReasons),
		vectorDistance:   searchResult.vectorDistance,
		cafeId:           searchResult.cafeId || undefined
	});
};

export const serializeSearchResults = async (ctx: Koa.Context, searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>) => {
	const searchResultPromises: Array<Promise<ISearchResponseResult>> = [];
	const areModifiersAllowed = supportsVersionTag(ctx, VERSION_TAG.modifiersInSearchResults);

	for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
		for (const searchResult of searchResultsById.values()) {
			searchResultPromises.push(serializeSearchResult(searchResult, areModifiersAllowed));
		}
	}

	ctx.body = jsonStringifyWithoutNull(await Promise.all(searchResultPromises));
};

export const requireDevKey: Middleware = async (ctx, next) => {
	const key = getTrimmedQueryParam(ctx, 'key');
	if (key !== getDevKey()) {
		return ctx.throw(403, 'Invalid dev key');
	}

	await next();
}

export const requireRole = (role: string): Middleware => {
	return async (ctx, next) => {
		if (!ctx.isAuthenticated()) {
			return ctx.throw(401, 'User not authenticated');
		}

		const userId = ctx.state.user;
		const user = await UserStorageClient.getUserAsync({
			id: userId
		});

		if (!user) {
			return ctx.throw(500, 'User not found');
		}

		if (user.role !== role) {
			return ctx.throw(403, `User does not have the required role: ${role}`);
		}

		await next();
	}
}

export const requireAdmin = requireRole('admin');

export const getEntityTypeAndName = (ctx: Koa.Context): [SearchEntityType, string] => {
	const entityTypeRaw = getTrimmedQueryParam(ctx, 'type');
	const entityName = getTrimmedQueryParam(ctx, 'name');

	if (!entityTypeRaw || !entityName) {
		ctx.throw(400, 'Missing type or id');
	}

	const entityType = SearchEntityType[entityTypeRaw as keyof typeof SearchEntityType];
	if (!entityType) {
		ctx.throw(400, 'Invalid entityType');
	}

	return [entityType, entityName];
}

export const getMaybeUserId = (ctx: Koa.Context): string | null => {
	const userId = ctx.state.user;

	if (!userId || typeof userId !== 'string') {
		return null;
	}

	return userId;
}

export const getUserIdOrThrow = (ctx: Koa.Context): string => {
	if (!ctx.isAuthenticated()) {
		ctx.throw(401, 'User not authenticated');
	}

	const userId = ctx.state.user;
	if (!userId) {
		ctx.throw(500, 'User ID not found in session');
	}

	return userId;
}

export const getUserOrThrowAsync = async (ctx: Koa.Context): Promise<IServerUser> => {
	const id = getUserIdOrThrow(ctx);

	const user = await UserStorageClient.getUserAsync({ id });

	if (!user) {
		ctx.throw(500, 'User not found');
	}

	return user;
}

export const assignCacheControl = (ctx: Koa.Context, maxAge: DurationOrMilliseconds, isPublic: boolean = false) => {
	ctx.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=${Duration.fromDurationOrMilliseconds(maxAge).inSeconds}`);
	ctx.set('Vary', VERSION_TAG_HEADER);
}

export const CATCH_ALL_PATH = '(.*)';