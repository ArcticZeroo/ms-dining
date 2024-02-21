import { isDuckType } from '@arcticzeroo/typeguard';
import Router, { RouterContext } from '@koa/router';
import {
    ICardData,
    ICartItem,
    IOrderCompletionResponse,
    ISerializedCartItem,
    ISerializedModifier,
    ISubmitOrderItems,
    ISubmitOrderRequest,
    SubmitOrderStage
} from '@msdining/common/dist/models/cart.js';
import { attachRouter } from '../../../util/koa.js';
import { CafeOrderSession } from '../../../api/cafe/session/order.js';
import { ICafe } from '../../../models/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { DateUtil } from '@msdining/common';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { MenuItemStorageClient } from '../../../api/storage/clients/menu-item.js';
import { IMenuItemModifier } from '@msdining/common/dist/models/cafe.js';
import { WaitTimeSession } from '../../../api/cafe/session/wait-time.js';
import { cafesById } from '../../../constants/cafes.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import Duration from '@arcticzeroo/duration';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { phone } from 'phone';

const isDuckTypeModifier = (data: unknown): data is ISerializedModifier => {
    if (!isDuckType<ISerializedModifier>(data, { modifierId: 'string', choiceIds: 'object' })) {
        return false;
    }

    if (!Array.isArray(data.choiceIds)) {
        return false;
    }

    return data.choiceIds.every(choiceId => typeof choiceId === 'string');
}

const isDuckTypeSerializedCartItem = (data: unknown): data is ISerializedCartItem => {
    if (!isDuckType<ISerializedCartItem>(data, {
        itemId:    'string',
        quantity:  'number',
        modifiers: 'object',
    })) {
        return false;
    }

    if (data.specialInstructions != null && typeof data.specialInstructions !== 'string') {
        return false;
    }

    if (!data.modifiers.every(isDuckTypeModifier)) {
        return false;
    }

    return true;
}

const isDuckTypeJsonObject = (data: unknown): data is Record<string, unknown> => {
    return data != null && typeof data === 'object' && !Array.isArray(data);
}

const isValidItemsByCafeId = (data: unknown): data is ISubmitOrderItems => {
    if (!isDuckTypeJsonObject(data)) {
        return false;
    }

    for (const items of Object.values(data)) {
        if (!Array.isArray(items)) {
            return false;
        }

        if (!items.every(isDuckTypeSerializedCartItem)) {
            return false;
        }
    }

    return true;
}

const isValidSubmitOrderParams = (data: unknown): data is ISubmitOrderRequest => {
    if (!isDuckType<ISubmitOrderRequest>(data, {
        itemsByCafeId:              'object',
        phoneNumberWithCountryCode: 'string',
        alias:                      'string',
        cardData:                   'object'
    })) {
        return false;
    }

    if (!Object.values(data.itemsByCafeId).every(items => items.every(isDuckTypeSerializedCartItem))) {
        return false;
    }

    if (!isDuckType<ICardData>(data.cardData, {
        userAgent:       'string',
        cardNumber:      'string',
        name:            'string',
        expirationMonth: 'string',
        expirationYear:  'string',
        postalCode:      'string',
        securityCode:    'string'
    })) {
        return false;
    }

    return true;
}

const isModifierValid = (modifier: IMenuItemModifier, choiceIds: Set<string>): boolean => {
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
            const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(serializedItem.itemId);

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
        memoizeResponseBodyByQueryParams(new Duration({ minutes: 5 })),
        async ctx => {
            const cafeId = ctx.params.cafeId;

            if (!cafeId) {
                return ctx.throw(400, 'Invalid cafe id');
            }

            const cafe = cafesById.get(cafeId);
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

            const session = new WaitTimeSession(cafe);
            await session.initialize();
            const waitTime = await session.retrieveWaitTime(itemCount);
            ctx.body = JSON.stringify(waitTime);
        }
    );

    const validateAndPrepareOrderSessions = async (ctx: RouterContext, itemsByCafeId: ISubmitOrderItems, prepareBeforeOrder: boolean) => {
        const cartItemsByCafeId = await validateCartData(ctx, itemsByCafeId);

        const orderSessionsByCafeId = new Map<string, CafeOrderSession>();
        const preparePromises: Array<Promise<void>> = [];

        const prepareSession = async (cafeId: string, cartData: ICafeCartData) => {
            const session = new CafeOrderSession(cartData.cafe, cartData.cartItems);
            orderSessionsByCafeId.set(cafeId, session);
            await session.initialize();
            await session.populateCart();

            if (prepareBeforeOrder) {
                await session.prepareBeforeOrder();
            }
        }

        for (const [cafeId, cartData] of cartItemsByCafeId) {
            preparePromises.push(prepareSession(cafeId, cartData));
        }

        await Promise.all(preparePromises);

        for (const [cafeId, session] of orderSessionsByCafeId.entries()) {
            if (prepareBeforeOrder) {
                if (!session.isReadyForSubmit) {
                    return ctx.throw(500, `Cafe ${cafeId} is not ready to submit order`);
                }
            } else {
                if (session.lastCompletedStage !== SubmitOrderStage.addToCart) {
                    return ctx.throw(500, `Cafe ${cafeId} did not successfully populate the cart!`);
                }
            }
        }

        return orderSessionsByCafeId;
    }

    router.post('/price', async ctx => {
        const itemsByCafeId = ctx.request.body;

        if (!isValidItemsByCafeId(itemsByCafeId)) {
            return ctx.throw(400, 'Invalid request body');
        }

        const orderSessionsByCafeId = await validateAndPrepareOrderSessions(ctx, itemsByCafeId, false /*prepareBeforeOrder*/);

        let totalPriceWithTax = 0;
        let totalPriceWithoutTax = 0;
        let totalTax = 0;

        for (const session of orderSessionsByCafeId.values()) {
            totalPriceWithTax += session.orderTotalWithTax;
            totalPriceWithoutTax += session.orderTotalWithoutTax;
            totalTax += session.orderTotalTax;
        }

        ctx.body = jsonStringifyWithoutNull({
            totalPriceWithTax,
            totalPriceWithoutTax,
            totalTax
        });
    });

    // If you happen to be reading this code on github, don't try requesting to this endpoint right now!
    // It's probably not going to work, and you might get charged for an order you didn't place.
    router.post('/', async ctx => {
        const data = ctx.request.body;

        if (!isValidSubmitOrderParams(data)) {
            return ctx.throw(400, 'Invalid request body');
        }

        const phoneData = phone(data.phoneNumberWithCountryCode);

        if (!phoneData.isValid) {
            return ctx.throw(400, 'Invalid phone number');
        }

        const orderSessionsByCafeId = await validateAndPrepareOrderSessions(ctx, data.itemsByCafeId, true /*prepareBeforeOrder*/);

        const orderPromises: Array<Promise<void>> = [];

        for (const session of orderSessionsByCafeId.values()) {
            orderPromises.push(session.submitOrder({
                alias:                      data.alias,
                cardData:                   data.cardData,
                phoneData
            }));
        }

        await Promise.all(orderPromises);

        const response: IOrderCompletionResponse = {};
        for (const [cafeId, session] of orderSessionsByCafeId.entries()) {
            const orderNumber = session.orderNumber;
            if (orderNumber == null) {
                console.error(`Order number for cafe ${cafeId} is null`);
            }

            response[cafeId] = {
                lastCompletedStage: SubmitOrderStage.complete,
                orderNumber:        orderNumber ?? 'Unknown',
                waitTimeMin:        '0',
                waitTimeMax:        '0'
            };
        }

        ctx.body = JSON.stringify(response);
    });

    attachRouter(parent, router);
}