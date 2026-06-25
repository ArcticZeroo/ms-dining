/**
 * Integration test for multi-item cart population.
 *
 * Regression target: adding multiple items used to POST every item to
 * /orders, creating a brand-new order each time. The fix POSTs the first item
 * to create the order, then PUTs each subsequent item to
 * /orders/{orderId} so they all land on one order. This test drives
 * populateCart() end-to-end against the in-memory BoD server and asserts the
 * POST-first / PUT-subsequent wire shape, a single stable order, a shared
 * cartGuid with distinct per-item uniqueIds, and cumulative totals.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { IOrderItem } from '@msdining/common/models/order';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { CafeOrderSession } from './order.js';
import { ICafe } from '../../../../shared/models/cafe.js';
import { usePrismaWrite } from '../../storage/client.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

const CAFE_ID = 'cafe25';
const CAFE: ICafe = { id: CAFE_ID, name: 'Test Cafe 25' };
const STATION_ID = 'multi-item-station';

const ITEM_A_ID = 'mi-multi-a';
const ITEM_B_ID = 'mi-multi-b';
const ITEM_A_PRICE = 5;
const ITEM_B_PRICE = 7.5;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

// cafe25 is normally pre-seeded by the integration context's cafe fixtures, but
// upsert so the FK target for the station/menu items exists regardless.
const seedCafe = () =>
    usePrismaWrite(prisma => prisma.cafe.upsert({
        where:  { id: CAFE_ID },
        update: {},
        create: {
            id:               CAFE_ID,
            name:             CAFE.name,
            tenantId:         't-' + CAFE_ID,
            contextId:        'ctx-' + CAFE_ID,
            displayProfileId: 'dp-' + CAFE_ID,
            storeId:          's-' + CAFE_ID,
            externalName:     CAFE.name,
            logoName:         null,
        },
    }));

const seedStation = () =>
    usePrismaWrite(prisma => prisma.station.create({
        data: {
            id:             STATION_ID,
            cafeId:         CAFE_ID,
            name:           'Multi Item Station',
            normalizedName: normalizeNameForSearch('Multi Item Station'),
            menuId:         'menu-' + STATION_ID,
            logoUrl:        null,
            groupId:        null,
            // Open all day so schedule synthesis always succeeds.
            opensAt:        0,
            closesAt:       1440,
        },
    }));

const seedMenuItem = (id: string, name: string, price: number) =>
    usePrismaWrite(prisma => prisma.menuItem.create({
        data: {
            id,
            cafeId:         CAFE_ID,
            stationId:      STATION_ID,
            name,
            normalizedName: normalizeNameForSearch(name),
            description:    null,
            imageUrl:       null,
            tags:           null,
            calories:       500,
            maxCalories:    500,
            price,
        },
    }));

interface IWireCartItem {
    itemId?: string;
    uniqueId?: string;
    properties?: { cartGuid?: string };
}

// Pull the wire cart item out of an order request body (POST uses `item`,
// PUT uses `itemList`).
const getCartItemFromOrderRequestBody = (body: unknown): IWireCartItem => {
    const typedBody = body as { item?: IWireCartItem; itemList?: IWireCartItem };
    return typedBody.item ?? typedBody.itemList ?? {};
};

test('populateCart creates one order and appends subsequent items via PUT', async () => {
    await seedCafe();
    await seedStation();
    await seedMenuItem(ITEM_A_ID, 'Item A', ITEM_A_PRICE);
    await seedMenuItem(ITEM_B_ID, 'Item B', ITEM_B_PRICE);

    // Item A appears twice (different lines) to prove duplicate menu items still
    // get distinct uniqueIds.
    const orderItems: IOrderItem[] = [
        { menuItemId: ITEM_A_ID, quantity: 1, modifiers: [], specialInstructions: '' },
        { menuItemId: ITEM_B_ID, quantity: 2, modifiers: [], specialInstructions: '' },
        { menuItemId: ITEM_A_ID, quantity: 1, modifiers: [], specialInstructions: '' },
    ];

    ctx.server.clearRequestLog();

    const session = await CafeOrderSession.createAsync(CAFE, orderItems);
    await session.populateCart();

    const orderId = session.orderId;
    assert.ok(orderId, 'session should have a non-empty orderId after population');

    const requestLog = ctx.server.getRequestLog();

    const postRequests = requestLog.filter(entry => entry.method === 'POST' && /\/orders$/.test(entry.path));
    const putRequests = requestLog.filter(entry => entry.method === 'PUT' && /\/orders\/[^/]+$/.test(entry.path));

    // Exactly one POST (create) and N-1 PUTs (append).
    assert.equal(postRequests.length, 1, 'exactly one POST /orders should create the order');
    assert.equal(putRequests.length, orderItems.length - 1, 'each item after the first should be a PUT');

    // Every PUT targets the single created order.
    for (const putRequest of putRequests) {
        assert.ok(
            putRequest.path.endsWith(`/orders/${orderId}`),
            `PUT should target the created order, got ${putRequest.path}`,
        );
    }

    // Items are added in cart order: POST first, then PUTs in sequence.
    const orderRequestsInOrder = [...postRequests, ...putRequests];
    const wireItems = orderRequestsInOrder.map(entry => getCartItemFromOrderRequestBody(entry.body));
    assert.deepEqual(
        wireItems.map(item => item.itemId),
        orderItems.map(orderItem => orderItem.menuItemId),
        'order requests should carry items in cart order',
    );

    // One shared cartGuid across all items.
    const cartGuids = new Set(wireItems.map(item => item.properties?.cartGuid));
    assert.equal(cartGuids.size, 1, 'all items should share a single cartGuid');
    const [cartGuid] = [...cartGuids];
    assert.ok(cartGuid, 'cartGuid should be set');

    // Distinct per-item uniqueIds, none equal to the cartGuid.
    const uniqueIds = wireItems.map(item => item.uniqueId);
    assert.equal(new Set(uniqueIds).size, uniqueIds.length, 'each item should have a distinct uniqueId');
    for (const uniqueId of uniqueIds) {
        assert.notEqual(uniqueId, cartGuid, 'uniqueId must differ from cartGuid');
    }

    // Totals are cumulative across the whole order.
    const expectedSubtotal = ITEM_A_PRICE * 1 + ITEM_B_PRICE * 2 + ITEM_A_PRICE * 1;
    assert.ok(Math.abs(session.price.subtotal - expectedSubtotal) < 0.001, `subtotal should be ${expectedSubtotal}, got ${session.price.subtotal}`);
    assert.ok(session.price.tax > 0, 'tax should be greater than zero');
    assert.ok(
        Math.abs(session.price.total - (session.price.subtotal + session.price.tax)) < 0.001,
        'total should equal subtotal + tax',
    );

    // Wait-time requests reuse the same cartGuid + uniqueIds as the adds
    // (deterministic rebuild from the session start time).
    await session.retrieveWaitTime();
    const waitTimeRequest = ctx.server.getRequestLog()
        .filter(entry => /\/getWaitTimeForItems$/.test(entry.path))
        .at(-1);
    assert.ok(waitTimeRequest, 'a wait-time request should have been issued');

    const waitTimeItems = (waitTimeRequest.body as { cartItems?: IWireCartItem[] }).cartItems ?? [];
    assert.deepEqual(
        waitTimeItems.map(item => item.uniqueId),
        uniqueIds,
        'wait-time items should reuse the add-time uniqueIds',
    );
    for (const waitTimeItem of waitTimeItems) {
        assert.equal(waitTimeItem.properties?.cartGuid, cartGuid, 'wait-time items should reuse the cartGuid');
    }
});
