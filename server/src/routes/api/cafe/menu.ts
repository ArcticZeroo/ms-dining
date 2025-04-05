import Router from '@koa/router';
import { IMenuItemDTO, IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import {
	ICreateReviewRequest, IUpdateReviewRequest,
	MenuResponse,
	REVIEW_MAX_COMMENT_LENGTH_CHARS
} from '@msdining/common/dist/models/http.js';
import { ERROR_BODIES } from '@msdining/common/dist/responses.js';
import { isAnyCafeCurrentlyUpdating, isCafeCurrentlyUpdating } from '../../../api/cafe/cache/update.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { ICafe, ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { getDefaultUniquenessDataForStation, getStationLogoUrl } from '../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../util/date.js';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import {
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverview, getApplicationNameForReviews
} from '@msdining/common/dist/constants/analytics.js';
import { sendVisitFromCafeParamMiddleware } from '../../../middleware/analytics.js';
import { ReviewStorageClient } from '../../../api/storage/clients/review.js';
import { MenuItemStorageClient } from '../../../api/storage/clients/menu-item.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { requireAuthenticated } from '../../../middleware/auth.js';

const getUniquenessDataForStation = (station: ICafeStation, uniquenessData: Map<string, IStationUniquenessData> | null): IStationUniquenessData => {
	if (uniquenessData == null || !uniquenessData.has(station.name)) {
		return getDefaultUniquenessDataForStation(station.menuItemsById.size);
	}

	return uniquenessData.get(station.name)!;
};

export const registerMenuRoutes = (parent: Router) => {
	const router = new Router({
		prefix: '/menu'
	});

	const serializeMenuItem = (menuItem: IMenuItem): IMenuItemDTO => ({
		...menuItem,
		tags:       Array.from(menuItem.tags),
		searchTags: Array.from(menuItem.searchTags)
	});

	const convertMenuToSerializable = (menuStations: ICafeStation[], uniquenessData: Map<string, IStationUniquenessData> | null): MenuResponse => {
		const menusByStation: MenuResponse = [];

		for (const station of menuStations) {
			const uniquenessDataForStation = getUniquenessDataForStation(station, uniquenessData);

			const itemsByCategory: Record<string, Array<IMenuItemDTO>> = {};

			for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
				const itemsForCategory: IMenuItemDTO[] = [];

				for (const itemId of categoryItemIds) {
					// Expected; Some items are 86-ed
					if (!station.menuItemsById.has(itemId)) {
						continue;
					}

					itemsForCategory.push(serializeMenuItem(station.menuItemsById.get(itemId)!));
				}

				if (itemsForCategory.length === 0) {
					continue;
				}

				itemsByCategory[categoryName] = itemsForCategory;
			}

			if (Object.keys(itemsByCategory).length === 0) {
				continue;
			}

			menusByStation.push({
				name:       station.name,
				logoUrl:    getStationLogoUrl(station.name, station.logoUrl),
				menu:       itemsByCategory,
				uniqueness: uniquenessDataForStation,
			});
		}

		return menusByStation;
	};

	const getCafeFromRequest = async (ctx: Router.RouterContext) => {
		const id = ctx.params.id?.toLowerCase();
		if (!id) {
			ctx.throw(400, 'Missing cafe id');
		}

		const cafe = await CafeStorageClient.retrieveCafeAsync(id);
		if (!cafe) {
			ctx.throw(404, 'Cafe not found or data is missing');
		}

		return cafe;
	}

	const validateCafeMenuAccessAsync = async (ctx: Router.RouterContext, onReady: (cafe: ICafe, dateString: string) => Promise<void>) => {
		const cafe = await getCafeFromRequest(ctx);

		const dateString = getDateStringForMenuRequest(ctx);
		if (dateString == null) {
			ctx.body = JSON.stringify([]);
			return;
		}

		if (isCafeCurrentlyUpdating(dateString, cafe)) {
			ctx.status = 503;
			ctx.body = ERROR_BODIES.menusCurrentlyUpdating;
			return;
		}

		return onReady(cafe, dateString);
	};

	router.get('/:id',
		sendVisitFromCafeParamMiddleware(getApplicationNameForCafeMenu),
		memoizeResponseBodyByQueryParams(),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const menuStations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafe.id, dateString);

			let uniquenessData: Map<string, IStationUniquenessData> | null = null;
			if (!isAnyCafeCurrentlyUpdating() && menuStations.length > 0) {
				uniquenessData = await DailyMenuStorageClient.retrieveUniquenessDataForCafe(cafe.id, dateString);
			}

			ctx.body = jsonStringifyWithoutNull(convertMenuToSerializable(menuStations, uniquenessData));
		}));

	router.get('/:id/overview',
		sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverview),
		memoizeResponseBodyByQueryParams(),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const overviewStations = await DailyMenuStorageClient.retrieveDailyMenuOverviewAsync(cafe.id, dateString);
			ctx.body = jsonStringifyWithoutNull(overviewStations);
		}));

	const maybeGetCafeFromQueryAsync = async (ctx: Router.RouterContext) => {
		const id = ctx.query.cafeId;
		if (!id || typeof id !== 'string') {
			return null;
		}

		const cafe = await CafeStorageClient.retrieveCafeAsync(id);
		if (!cafe) {
			return null;
		}

		return cafe;
	}

	const getMenuItemFromRequest = async (ctx: Router.RouterContext) => {
		const menuItemId = ctx.params.menuItemId;
		if (!menuItemId) {
			ctx.throw(400, 'Missing menu item id');
		}

		const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(menuItemId);
		if (menuItem == null) {
			ctx.throw(404, 'Menu item not found');
		}

		return menuItem;
	}

	router.get('/menu-items/:menuItemId/reviews',
		sendVisitFromCafeParamMiddleware(getApplicationNameForReviews),
		memoizeResponseBodyByQueryParams(),
		async ctx => {
			const menuItem = await getMenuItemFromRequest(ctx);
			const maybeCafe = await maybeGetCafeFromQueryAsync(ctx);

			// todo: limit? paging?
			const reviews = await ReviewStorageClient.getReviewsForMenuItemAsync(menuItem.id, maybeCafe?.id);
			ctx.body = jsonStringifyWithoutNull(reviews);
		});

	router.post('/menu-items/:menuItemId/reviews',
		requireAuthenticated,
		async ctx => {
			const menuItem = await getMenuItemFromRequest(ctx);

			const body = ctx.request.body;
			if (!isDuckType<ICreateReviewRequest>(body, { cafeId: 'string', rating: 'number' })) {
				ctx.throw(400, 'Invalid review');
				return;
			}

			if (!(await CafeStorageClient.doesCafeExistAsync(body.cafeId))) {
				ctx.throw(400, 'Invalid cafe id');
				return;
			}

			if (typeof body.comment !== 'string' || body.comment.length > REVIEW_MAX_COMMENT_LENGTH_CHARS) {
				ctx.throw(400, 'Invalid review comment');
				return;
			}

			const review = await ReviewStorageClient.createReviewAsync({
				menuItemId: menuItem.id,
				cafeId:     body.cafeId,
				userId:     getUserIdOrThrow(ctx),
				rating:     body.rating,
				comment:    body.comment
			});

			ctx.body = {
				id: review.id
			};
		});

	const validateUpdateReviewRequest = (ctx: Router.RouterContext, body: unknown): IUpdateReviewRequest => {
		if (!isDuckType<Record<string, unknown>>(body, {})) {
			ctx.throw(400, 'Invalid update data');
		}

		const rating = body.rating ?? undefined;
		if (rating != null && typeof rating !== 'number') {
			ctx.throw(400, 'Invalid rating');
		}

		const comment = body.comment ?? undefined;
		if (comment != null && typeof comment !== 'string') {
			ctx.throw(400, 'Invalid comment');
		}

		if (comment != null && comment.length > REVIEW_MAX_COMMENT_LENGTH_CHARS) {
			ctx.throw(400, 'Invalid review comment');
		}

		return {
			rating:  rating,
			comment: comment
		};
	}

	router.get('/reviews/mine',
		requireAuthenticated,
		memoizeResponseBodyByQueryParams(),
		async ctx => {
			// todo: limit? paging?
			const reviews = await ReviewStorageClient.getReviewsForUserAsync(getUserIdOrThrow(ctx));
			ctx.body = jsonStringifyWithoutNull(reviews);
		});

	router.patch('/reviews/:reviewId',
		requireAuthenticated,
		async ctx => {
			const reviewId = ctx.params.reviewId;
			if (!reviewId) {
				ctx.throw(400, 'Missing review id');
				return;
			}

			const request = validateUpdateReviewRequest(ctx, ctx.request.body);
			await ReviewStorageClient.updateReviewAsync(reviewId, request);
		});

	attachRouter(parent, router);
};