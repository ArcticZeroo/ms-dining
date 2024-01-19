import { isDuckType } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import {
    ICardData, ICartItem,
    ISerializedCartItem,
    ISerializedModifier,
    ISubmitOrderParams
} from '@msdining/common/dist/models/cart.js';
import { attachRouter } from '../../../util/koa.js';

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
        itemId: 'string',
        quantity: 'number',
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

const isValidSubmitOrderParams = (data: unknown): data is ISubmitOrderParams<ISerializedCartItem> => {
    if (!isDuckType<ISubmitOrderParams<ISerializedCartItem>>(data, {
        items: 'object',
        phoneNumberWithCountryCode: 'string',
        alias: 'string',
        cardData: 'object'
    })) {
        return false;
    }

    if (!data.items.every(isDuckTypeSerializedCartItem)) {
        return false;
    }

    if (!isDuckType<ICardData>(data.cardData, {
        userAgent: 'string',
        cardNumber: 'string',
        name: 'string',
        expirationMonth: 'string',
        expirationYear: 'string',
        postalCode: 'string',
        securityCode: 'string'
    })) {
        return false;
    }

    return true;
}

export const registerOrderingRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/order'
    });

    router.post('/', ctx => {
        const data = ctx.request.body;

        if (!isValidSubmitOrderParams(data)) {
            ctx.throw(400, 'Invalid request body');
            return;
        }

        const cartItemsByCafeId = new Map<string, Array<ICartItem>>();

        // Step 1: Verify that all menu items exist, and that all of their modifiers are valid
        // Also, match items to their cafes

        // Step 2: Create an order session for each cafe

        // Step 3: order
    });

    attachRouter(parent, router);
}