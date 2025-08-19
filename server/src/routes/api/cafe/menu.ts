import Router from '@koa/router';
import { ICafeOverviewStation, IMenuItemDTO, IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import {
	ICreateReviewRequest,
	MenuResponse,
	REVIEW_MAX_COMMENT_LENGTH_CHARS
} from '@msdining/common/dist/models/http.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { ICafe, ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { getDefaultUniquenessDataForStation, getStationLogoUrl } from '../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../util/date.js';
import { attachRouter, getMaybeUserId, getTrimmedQueryParam, getUserIdOrThrow } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import {
	ANALYTICS_APPLICATION_NAMES,
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverview,
} from '@msdining/common/dist/constants/analytics.js';
import { sendVisitFromCafeParamMiddleware, sendVisitMiddleware } from '../../../middleware/analytics.js';
import { ReviewStorageClient } from '../../../api/storage/clients/review.js';
import { MenuItemStorageClient } from '../../../api/storage/clients/menu-item.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { Review } from '@prisma/client';
import { IReview, IReviewDataForMenuItem, IReviewWithComment } from '@msdining/common/dist/models/review.js';
import { toDateString } from '@msdining/common/dist/util/date-util.js';
import Duration from '@arcticzeroo/duration';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { retrieveDailyCafeMenuAsync } from '../../../api/cache/daily-menu.js';
import { retrieveUniquenessDataForCafe } from '../../../api/cache/daily-uniqueness.js';
import { ensureThumbnailDataHasBeenRetrievedAsync } from '../../../worker/interface/thumbnail.js';
import { logDebug } from '../../../util/log.js';
import { retrieveReviewHeaderAsync } from '../../../api/cache/reviews.js';
import { retrieveFirstMenuItemAppearance } from '../../../api/cache/menu-item-first-appearance.js';

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

	const serializeMenuItem = async (menuItem: IMenuItem): Promise<IMenuItemDTO> => {
		const [reviewHeader, firstAppearance] = await Promise.all([
			retrieveReviewHeaderAsync(normalizeNameForSearch(menuItem.name)),
			retrieveFirstMenuItemAppearance(menuItem.id),
			ensureThumbnailDataHasBeenRetrievedAsync(menuItem),
		]);

		return ({
			...reviewHeader,
			...menuItem,
			firstAppearance,
			lastUpdateTime: menuItem.lastUpdateTime?.getTime(),
			tags:           Array.from(menuItem.tags),
			searchTags:     Array.from(menuItem.searchTags)
		});
	};

	const convertMenuToSerializable = async (menuStations: ICafeStation[], uniquenessData: Map<string, IStationUniquenessData> | null): Promise<MenuResponse> => {
		const menusByStation: MenuResponse = [];

		const addStation = async (station: ICafeStation): Promise<void> => {
			const uniquenessDataForStation = getUniquenessDataForStation(station, uniquenessData);

			const itemsByCategory: Record<string, Array<IMenuItemDTO>> = {};

			const serializeCategory = async (categoryName: string, categoryItemIds: string[]) => {
				const serializedItems: Array<Promise<IMenuItemDTO>> = [];

				for (const itemId of categoryItemIds) {
					if (!station.menuItemsById.has(itemId)) {
						logDebug(`Menu item with id ${itemId} not found in station ${station.name}. Skipping.`);
						continue;
					}

					serializedItems.push(serializeMenuItem(station.menuItemsById.get(itemId)!));
				}

				itemsByCategory[categoryName] = await Promise.all(serializedItems);
			}

			const categoryPromises: Array<Promise<void>> = [];

			for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
				categoryPromises.push(serializeCategory(categoryName, categoryItemIds));
			}

			await Promise.all(categoryPromises);

			if (Object.keys(itemsByCategory).length === 0) {
				return;
			}

			menusByStation.push({
				name:       station.name,
				logoUrl:    getStationLogoUrl(station.name, station.logoUrl),
				menu:       itemsByCategory,
				uniqueness: uniquenessDataForStation,
			});
		}

		const stationPromises: Array<Promise<void>> = [];

		for (const station of menuStations) {
			stationPromises.push(addStation(station));
		}

		await Promise.all(stationPromises);

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

		return onReady(cafe, dateString);
	};

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

	const serializeReview = (review: Review & {
		user: { displayName: string },
		menuItem: { name: string, cafe: { id: string } }
	}): IReview => ({
		id:              review.id,
		userId:          review.userId,
		userDisplayName: review.user.displayName,
		menuItemId:      review.menuItemId,
		menuItemName:    review.menuItem.name,
		cafeId:          review.menuItem.cafe.id,
		rating:          review.rating,
		comment:         review.comment || undefined,
		createdDate:     toDateString(review.createdAt),
	});

	router.get('/menu-items/:menuItemId/reviews',
		sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.getReviews),
		// todo... figure out how to memo and deal with updates.
		async ctx => {
			const userId = getMaybeUserId(ctx);
			const menuItem = await getMenuItemFromRequest(ctx);

			// todo: limit? paging?
			const reviews = await ReviewStorageClient.getReviewsForMenuItemAsync(normalizeNameForSearch(menuItem.name));

			const response: IReviewDataForMenuItem = {
				counts:              {},
				reviewsWithComments: [],
				totalCount:          0,
				overallRating:       0,
			};

			for (const review of reviews) {
				response.totalCount += 1;
				response.overallRating += review.rating;
				response.counts[review.rating] = (response.counts[review.rating] || 0) + 1;

				if (review.comment != null && review.comment.trim().length > 0) {
					const serializedReview = serializeReview(review);
					serializedReview.comment = review.comment;
					response.reviewsWithComments.push(serializedReview as IReviewWithComment);
				}

				// Users can review the same item at multiple different cafes.
				if (review.menuItemId === menuItem.id && userId != null && review.userId === userId) {
					response.myReview = serializeReview(review);
				}
			}

			if (reviews.length > 0) {
				response.overallRating /= reviews.length;
			}

			ctx.body = jsonStringifyWithoutNull(response);
		});

	router.put('/menu-items/:menuItemId/reviews',
		requireAuthenticated,
		sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.postReview),
		async ctx => {
			const menuItem = await getMenuItemFromRequest(ctx);

			const body = ctx.request.body;
			if (!isDuckType<ICreateReviewRequest>(body, { rating: 'number' })) {
				ctx.throw(400, 'Invalid review');
				return;
			}

			if (body.comment != null && (typeof body.comment !== 'string' || body.comment.length > REVIEW_MAX_COMMENT_LENGTH_CHARS)) {
				ctx.throw(400, 'Invalid review comment');
				return;
			}

			if (body.rating < 1 || body.rating > 10) {
				ctx.throw(400, 'Invalid rating');
				return;
			}

			const userId = getUserIdOrThrow(ctx);

			const review = await ReviewStorageClient.createReviewAsync({
				userId,
				menuItemId:             menuItem.id,
				menuItemNormalizedName: normalizeNameForSearch(menuItem.name),
				rating:                 body.rating,
				comment:                body.comment?.trim()
			});

			ctx.body = {
				id: review.id
			};
		});

	router.get('/reviews/mine',
		requireAuthenticated,
		async ctx => {
			const menuItemId = getTrimmedQueryParam(ctx, 'menuItemId');

			if (menuItemId != null) {
				const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(menuItemId);
				if (menuItem == null) {
					ctx.throw(400, 'Invalid menu item');
					return;
				}
			}

			const reviews = await ReviewStorageClient.getReviewsForUserAsync({
				userId: getUserIdOrThrow(ctx),
				menuItemId
			});

			ctx.body = jsonStringifyWithoutNull(reviews.map(serializeReview));
		});

	router.get('/reviews/recent',
		memoizeResponseBodyByQueryParams({ expirationTime: new Duration({ minutes: 1 }), isPublic: true }),
		async ctx => {
			const reviews = await ReviewStorageClient.getRecentReviews(10);
			ctx.body = jsonStringifyWithoutNull(reviews.map(serializeReview));
		});

	const validateReviewOwnershipAsync = async (ctx: Router.RouterContext) => {
		const reviewId = ctx.params.reviewId;
		if (!reviewId) {
			ctx.throw(400, 'Missing review id');
		}

		if (!(await ReviewStorageClient.isOwnedByUser(reviewId, getUserIdOrThrow(ctx)))) {
			ctx.throw(403, 'Not allowed to modify another user\'s review');
		}

		return reviewId;
	}

	router.delete('/reviews/:reviewId',
		requireAuthenticated,
		async ctx => {
			const reviewId = await validateReviewOwnershipAsync(ctx);
			await ReviewStorageClient.deleteReviewAsync(reviewId);
			ctx.status = 204;
		});

	router.get('/search-ideas',
		memoizeResponseBodyByQueryParams({ isPublic: true }),
		async ctx => {
			ctx.body = MenuItemStorageClient.topSearchTags;
		});

	router.get('/:id',
		sendVisitFromCafeParamMiddleware(getApplicationNameForCafeMenu),
		memoizeResponseBodyByQueryParams({ isPublic: true }),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const [menuStations, uniquenessData] = await Promise.all([
				retrieveDailyCafeMenuAsync(cafe.id, dateString),
				retrieveUniquenessDataForCafe(cafe.id, dateString)
			]);

			ctx.body = jsonStringifyWithoutNull(await convertMenuToSerializable(menuStations, uniquenessData));
		}));

	router.get('/:id/overview',
		sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverview),
		memoizeResponseBodyByQueryParams({ isPublic: true }),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const [stationHeaders, uniquenessData] = await Promise.all([
				DailyMenuStorageClient.retrieveDailyMenuOverviewHeadersAsync(cafe.id, dateString),
				retrieveUniquenessDataForCafe(cafe.id, dateString)
			]);

			const overviewStations: ICafeOverviewStation[] = stationHeaders.map(station => ({
				...station,
				uniqueness: uniquenessData.get(station.name) ?? getDefaultUniquenessDataForStation()
			}));

			ctx.body = jsonStringifyWithoutNull(overviewStations);
		}));

	attachRouter(parent, router);
};