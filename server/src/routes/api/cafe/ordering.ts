import Duration from '@arcticzeroo/duration';
import { isDuckType } from '@arcticzeroo/typeguard';
import Router, { RouterContext } from '@koa/router';
import { DateUtil } from '@msdining/common';
import { IMenuItemModifier } from '@msdining/common/models/cafe';
import {
	ICartItem,
	ICompleteOrderRequest,
	ICompleteOrderResponse,
	IPrepareCartResponse,
	IPrepareOrderRequest,
	IPreparePaymentRequest,
	IPreparePaymentResponse,
	IRguestCardInfo,
	ISubmitOrderItems,
	SubmitOrderStage
} from '@msdining/common/models/cart';
import { toDateString } from '@msdining/common/util/date-util';
import { phone } from 'phone';
import { CafeOrderSession } from '../../../api/cafe/session/order.js';
import { WaitTimeSession } from '../../../api/cafe/session/wait-time.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { MenuItemStorageClient } from '../../../api/storage/clients/menu-item.js';
import { CAFES_BY_ID } from '../../../constants/cafes.js';
import { webserverHost } from '../../../constants/config.js';
import { isDev } from '../../../util/env.js';
import { memoizeResponseBody } from '../../../middleware/cache.js';
import { ICafe, IMenuItemBase } from '../../../models/cafe.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { isDuckTypeSerializedCartItem, isValidItemIdsByCafeId } from '../../../util/typeguard.js';

const isValidPrepareOrderParams = (data: unknown): data is IPrepareOrderRequest => {
    if (!isDuckType<IPrepareOrderRequest>(data, {
        itemsByCafeId: 'object',
    })) {
        return false;
    }

    return Object.values(data.itemsByCafeId).every(items => items.every(isDuckTypeSerializedCartItem));
}

const isValidPreparePaymentParams = (data: unknown): data is IPreparePaymentRequest => {
    return isDuckType<IPreparePaymentRequest>(data, {
        orderId: 'string',
    });
}

const isValidCompleteOrderParams = (data: unknown): data is ICompleteOrderRequest => {
    if (!isDuckType<ICompleteOrderRequest>(data, {
        orderId:                    'string',
        paymentToken:               'string',
        cardInfo:                   'object',
        alias:                      'string',
        phoneNumberWithCountryCode: 'string',
    })) {
        return false;
    }

    return isDuckType<IRguestCardInfo>(data.cardInfo, {
        accountNumberMasked: 'string',
        cardIssuer:          'string',
        expirationYearMonth: 'string',
        cardHolderName:      'string',
        postalCode:          'string',
    });
}

const isModifierValid= (modifier: IMenuItemModifier, choiceIds: Set<string>): boolean => {
    if (choiceIds.size < modifier.minimum || choiceIds.size > modifier.maximum) {
        return false;
    }

    for (const choiceId of choiceIds) {
        if (!modifier.choices.find(option => option.id === choiceId)) {
            return false;
        }
    }

    return true;
}

interface ICafeCartData {
    cafe: ICafe;
    cartItems: Array<ICartItem>;
}

const validateCartData = async (ctx: RouterContext, itemsByCafeId: ISubmitOrderItems): Promise<Map<string, ICafeCartData>> => {
    const cartDataByCafeId = new Map<string, ICafeCartData>();

    const nowDateString = DateUtil.toDateString(new Date());

    for (const [cafeId, serializedItems] of Object.entries(itemsByCafeId)) {
        const cafe = await CafeStorageClient.retrieveCafeAsync(cafeId);
        if (cafe == null) {
            return ctx.throw(400, `Cafe with id ${cafeId} does not exist`);
        }

        const cartData: ICafeCartData = {
            cafe,
            cartItems: []
        };

        const menu = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, nowDateString);

        for (const serializedItem of serializedItems) {
            const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(serializedItem.itemId);

            if (menuItem == null) {
                return ctx.throw(400, `Menu item with id ${serializedItem.itemId} does not exist`);
            }

            // Probably not massively expensive to do this O(n) search.
            if (!menu.find(station => station.menuItemsById.has(menuItem.id))) {
                return ctx.throw(400, `Menu item with id ${serializedItem.itemId} exists but is not available on the menu today for cafe ${cafeId}`);
            }

            const cartItem: ICartItem = {
                itemId:              serializedItem.itemId,
                quantity:            serializedItem.quantity,
                specialInstructions: serializedItem.specialInstructions,
                choicesByModifierId: new Map(serializedItem.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
            };

            for (const [modifierId, choiceIds] of cartItem.choicesByModifierId) {
                const modifier = menuItem.modifiers.find(modifier => modifier.id === modifierId);

                if (modifier == null) {
                    return ctx.throw(400, `Modifier with id ${modifierId} does not exist`);
                }

                if (!isModifierValid(modifier, choiceIds)) {
                    return ctx.throw(400, `Invalid choice(s) for modifier ${modifier.description}`);
                }
            }

            cartData.cartItems.push(cartItem);
        }

        cartDataByCafeId.set(cafeId, cartData);
    }

    return cartDataByCafeId;
}

export const registerOrderingRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/order'
    });

    router.get('/wait/:cafeId',
        memoizeResponseBody({ expirationTime: new Duration({ minutes: 5 }), isPublic: true }),
        async ctx => {
            const cafeId = ctx.params.cafeId;

            if (!cafeId) {
                return ctx.throw(400, 'Invalid cafe id');
            }

            const cafe = CAFES_BY_ID.get(cafeId);
            if (cafe == null) {
                return ctx.throw(400, `Cafe with id ${cafeId} does not exist`);
            }

            const itemCountRaw = ctx.query.items;

            if (!itemCountRaw || typeof itemCountRaw !== 'string') {
                return ctx.throw(400, 'Invalid item count (missing or wrong type)');
            }

            const itemCount = Number(itemCountRaw);

            if (Number.isNaN(itemCount) || itemCount < 1) {
                return ctx.throw(400, 'Invalid item count (not a positive number)');
            }

            const waitTime = await WaitTimeSession.retrieveWaitTime(cafe, itemCount);
            ctx.body = JSON.stringify(waitTime);
        }
    );

    // Session store for the two-phase iframe payment flow.
    // Sessions are stored after prepare and retrieved during complete.
    interface IPendingIframeSession {
        session:         CafeOrderSession;
        cafeId:          string;
        refreshInterval: ReturnType<typeof setInterval>;
        ttlTimeout:      ReturnType<typeof setTimeout>;
    }

    const pendingIframeSessions = new Map<string /*orderId*/, IPendingIframeSession>();

    const SESSION_TTL_MS = 30 * 60 * 1000;
    const TOKEN_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

    const cleanupPendingSession = (orderId: string) => {
        const pending = pendingIframeSessions.get(orderId);
        if (pending) {
            clearInterval(pending.refreshInterval);
            clearTimeout(pending.ttlTimeout);
            pendingIframeSessions.delete(orderId);
        }
    };

    const storePendingSession = (orderId: string, session: CafeOrderSession, cafeId: string) => {
        const refreshInterval = setInterval(() => {
            session.client.refreshLogin().catch(err => {
                console.error(`Failed to refresh token for order ${orderId}:`, err);
            });
        }, TOKEN_REFRESH_INTERVAL_MS);

        const ttlTimeout = setTimeout(() => cleanupPendingSession(orderId), SESSION_TTL_MS);

        pendingIframeSessions.set(orderId, {
            session,
            cafeId,
            refreshInterval,
            ttlTimeout,
        });
    };

    // Builds cart on the server and returns price data.
    // Sessions are stored so /prepare/payment can get the card processor token without re-building.
    // TODO: Diff-based cart updates instead of replacing the entire session each time.
    router.post('/prepare/cart', async ctx => {
        const data = ctx.request.body;

        if (!isValidPrepareOrderParams(data)) {
            return ctx.throw(400, 'Invalid request body');
        }

        const cartItemsByCafeId = await validateCartData(ctx, data.itemsByCafeId);

        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        const prepareResults: IPrepareCartResponse = {};

        await Promise.all(
            Array.from(cartItemsByCafeId).map(async ([cafeId, cartData]) => {
                const session = await CafeOrderSession.createAsync(cartData.cafe, cartData.cartItems);
                await session.populateCart();

                const orderId = session.orderId;
                if (!orderId || !session.orderNumber) {
                    throw new Error('Order ID or order number is not set after cart population');
                }

                const waitTime = await WaitTimeSession.retrieveWaitTimeWithCartItems(session.client, [...session.rawCartItemsForWaitTime]);

                storePendingSession(orderId, session, cafeId);

                prepareResults[cafeId] = {
                    orderId,
                    orderNumber:         session.orderNumber,
                    totalPriceWithTax:   session.orderTotalWithTax,
                    totalPriceWithoutTax: session.orderTotalWithoutTax,
                    totalTax:            session.orderTotalTax,
                    waitTimeMin:         waitTime.minTime,
                    waitTimeMax:         waitTime.maxTime,
                    expiresAt,
                };
            })
        );

        ctx.body = jsonStringifyWithoutNull(prepareResults);
    });

    // Gets the card processor token for an existing cart session (fast — cart already built).
    router.post('/prepare/payment', async ctx => {
        const data = ctx.request.body;

        if (!isValidPreparePaymentParams(data)) {
            return ctx.throw(400, 'Invalid request body');
        }

        const pending = pendingIframeSessions.get(data.orderId);
        if (pending == null || pending.session.lastCompletedStage !== SubmitOrderStage.addToCart) {
            return ctx.throw(400, 'No pending cart session found. The session may have expired — please try again.');
        }

        const iframeCssUrl = `${isDev ? ctx.origin : webserverHost}/iframe.css`;
        const result = await pending.session.prepareForIframe(iframeCssUrl);

        // Reset TTL since the user is actively paying
        clearTimeout(pending.ttlTimeout);
        pending.ttlTimeout = setTimeout(() => cleanupPendingSession(data.orderId), SESSION_TTL_MS);

        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

        const response: IPreparePaymentResponse = {
            siteToken:   result.siteToken,
            iframeUrl:   result.iframeUrl,
            orderId:     result.orderId,
            orderNumber: result.orderNumber,
            expiresAt,
        };

        ctx.body = jsonStringifyWithoutNull(response);
    });

    router.post('/complete', async ctx => {
        const data = ctx.request.body;

        if (!isValidCompleteOrderParams(data)) {
            return ctx.throw(400, 'Invalid request body');
        }

        const phoneData = phone(data.phoneNumberWithCountryCode);

        if (!phoneData.isValid) {
            return ctx.throw(400, 'Invalid phone number');
        }

        const pending = pendingIframeSessions.get(data.orderId);
        if (pending == null || pending.session.lastCompletedStage !== SubmitOrderStage.initializeCardProcessor) {
            return ctx.throw(400, 'No pending order session found. The order may have expired — please try again.');
        }

        // TODO: some sort of lock to avoid multiple completions, for now just delete to prevent a second one
        cleanupPendingSession(data.orderId);

        await pending.session.completeWithIframeToken({
            alias:        data.alias,
            phoneData,
            paymentToken: data.paymentToken,
            cardInfo:     data.cardInfo,
        });

        const orderNumber = pending.session.orderNumber;
        if (orderNumber == null) {
            console.error(`Order number for cafe ${pending.cafeId} is null`);
        }

        const response: ICompleteOrderResponse = {
            lastCompletedStage: pending.session.lastCompletedStage,
            orderNumber:        orderNumber ?? 'Unknown',
            waitTimeMin:        '0',
            waitTimeMax:        '0'
        };

        ctx.body = JSON.stringify(response);
    });

    router.post('/hydrate',
        async ctx => {
            const itemIdsByCafeId = ctx.request.body;

            if (!isValidItemIdsByCafeId(itemIdsByCafeId)) {
                ctx.body = JSON.stringify([]);
                return;
            }

            const nowString = toDateString(new Date());

            const retrieveItemsForCafe = async (cafeId: string, itemIds: string[]) => {
                const remainingItemIds = new Set(itemIds);
                const items: IMenuItemBase[] = [];

                const stations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, nowString);

                for (const station of stations) {
                    for (const itemId of remainingItemIds) {
                        if (station.menuItemsById.has(itemId)) {
                            remainingItemIds.delete(itemId);
                            items.push(station.menuItemsById.get(itemId)!);
                        }
                    }
                }

                return [cafeId, items] as const;
            }

            const hydrateResults = await Promise.all(
                Object.entries(itemIdsByCafeId)
                    .map(([cafeId, itemIds]) => retrieveItemsForCafe(cafeId, itemIds))
            );

            ctx.body = jsonStringifyWithoutNull(Object.fromEntries(hydrateResults));
        });

    attachRouter(parent, router);
}