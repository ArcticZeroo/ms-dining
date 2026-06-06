/**
 * Integration tests for order history + order count.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../shared/services/registry.js';
import { usePrismaTransaction, usePrismaWrite } from '../../client.js';
import { OrderStorageClient } from './order.js';

let ctx: IntegrationTestContext;

const USER_ID = 'order-history-user';
const RECENT_USER_ID = 'recent-order-user';
const METRICS_USER_ID = 'order-metrics-user';
const CAFE_ID = 'order-history-cafe';
const MENU_ITEM_ID = 'order-history-item';
const GROUPED_MENU_ITEM_ID = 'order-history-grouped-item';
const GROUPED_MENU_ITEM_GROUP_ID = 'order-history-group';

const createOrderAt = (userId: string, completedAt: Date, orderNumber: string, menuItemId: string = MENU_ITEM_ID) => {
    return usePrismaWrite(prisma => prisma.cafeOrder.create({
        data: {
            userId,
            cafeId:                 CAFE_ID,
            buyOnDemandOrderId:     `bod-${orderNumber}`,
            buyOnDemandOrderNumber: orderNumber,
            subtotal:               10.00,
            tax:                    1.00,
            total:                  11.00,
            waitTimeMin:            5,
            waitTimeMax:            10,
            completedAt,
            items: {
                create: [{
                    menuItemId,
                    name:                'Test Burger',
                    quantity:            1,
                    price:               10.00,
                    specialInstructions: null,
                }],
            },
        },
    }));
};

const createOrder = (daysAgo: number, orderNumber: string) => {
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - daysAgo);

    return createOrderAt(USER_ID, completedAt, orderNumber);
};

const createRecentOrder = (minutesAgo: number, orderNumber: string) => {
    const completedAt = new Date();
    completedAt.setMinutes(completedAt.getMinutes() - minutesAgo);

    return createOrderAt(RECENT_USER_ID, completedAt, orderNumber);
};

before(async () => {
    ctx = await createIntegrationTestContext();

    await usePrismaTransaction(async prisma => {
        await prisma.user.create({
            data: { id: USER_ID, externalId: 'hist-ext', provider: 'test', displayName: 'History Tester' },
        });
        await prisma.user.create({
            data: { id: RECENT_USER_ID, externalId: 'recent-ext', provider: 'test', displayName: 'Recent Tester' },
        });
        await prisma.user.create({
            data: { id: METRICS_USER_ID, externalId: 'metrics-ext', provider: 'test', displayName: 'Metrics Tester' },
        });
        await prisma.cafe.create({
            data: {
                id: CAFE_ID, name: 'History Café', tenantId: 't', contextId: 'c',
                displayProfileId: 'd', storeId: 's', externalName: 'e',
            },
        });
        await prisma.station.create({
            data: {
                id: 'order-history-station', name: 'Station', menuId: 'menu-1',
                cafeId: CAFE_ID, normalizedName: 'station',
            },
        });
        await prisma.menuItem.create({
            data: {
                id: MENU_ITEM_ID, name: 'Test Burger', normalizedName: 'test burger',
                calories: 500, maxCalories: 500, price: 10.00,
                cafeId: CAFE_ID, stationId: 'order-history-station',
            },
        });
        await prisma.crossCafeGroup.create({
            data: { id: GROUPED_MENU_ITEM_GROUP_ID, name: 'Grouped Burger', entityType: 'menuItem' },
        });
        await prisma.menuItem.create({
            data: {
                id: GROUPED_MENU_ITEM_ID, name: 'Grouped Burger', normalizedName: 'grouped burger',
                calories: 500, maxCalories: 500, price: 10.00,
                cafeId: CAFE_ID, stationId: 'order-history-station',
                groupId: GROUPED_MENU_ITEM_GROUP_ID,
            },
        });
    });

    // Create orders at different ages
    await createOrder(1, '001');   // yesterday
    await createOrder(5, '002');   // 5 days ago (within 7d)
    await createOrder(15, '003'); // 15 days ago (within 30d, outside 7d)
    await createOrder(45, '004'); // 45 days ago (outside 30d)

    await createRecentOrder(10, '101');
    await createRecentOrder(29, '102');
    await createRecentOrder(31, '103');

    // Metrics user: 3 orders of the ungrouped item, 2 of the grouped item
    await createOrderAt(METRICS_USER_ID, new Date(), 'm001');
    await createOrderAt(METRICS_USER_ID, new Date(), 'm002');
    await createOrderAt(METRICS_USER_ID, new Date(), 'm003');
    await createOrderAt(METRICS_USER_ID, new Date(), 'm004', GROUPED_MENU_ITEM_ID);
    await createOrderAt(METRICS_USER_ID, new Date(), 'm005', GROUPED_MENU_ITEM_ID);
});

after(async () => {
    await ctx.cleanup();
});

/** todo: update for getOrderHistorySummary
test('getOrderCount returns total count', async () => {
    const count = await getServices().data.order.getOrderCount({ userId: USER_ID });
    assert.equal(count, 4);
});

test('getOrderCount returns 0 for unknown user', async () => {
    const count = await getServices().data.order.getOrderCount({ userId: 'nobody' });
    assert.equal(count, 0);
});
**/

test('getRecentOrders returns only orders from the last 30 minutes', async () => {
    const orders = await getServices().data.order.getRecentOrders({ userId: RECENT_USER_ID });
    assert.equal(orders.length, 2);
    assert.deepEqual(orders.map(order => order.orderNumber), ['101', '102']);
    assert.ok(orders.every(order => order.completedAt instanceof Date));
});

test('getRecentOrders returns empty for unknown user', async () => {
    const orders = await getServices().data.order.getRecentOrders({ userId: 'nobody' });
    assert.equal(orders.length, 0);
});

test('getOrderHistory with since=7d returns only recent orders', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: '7d' });
    assert.equal(orders.length, 2);
    const orderNumbers = orders.map(order => order.buyOnDemandOrderNumber).sort();
    assert.deepEqual(orderNumbers, ['001', '002']);
});

test('getOrderHistory with since=30d returns orders within 30 days', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: '30d' });
    assert.equal(orders.length, 3);
    const orderNumbers = orders.map(order => order.buyOnDemandOrderNumber).sort();
    assert.deepEqual(orderNumbers, ['001', '002', '003']);
});

test('getOrderHistory with since=all returns all orders', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: 'all' });
    assert.equal(orders.length, 4);
});

test('getOrderHistory returns orders sorted by completedAt desc', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: 'all' });
    const orderNumbers = orders.map(order => order.buyOnDemandOrderNumber);
    assert.deepEqual(orderNumbers, ['001', '002', '003', '004']);
});

test('getOrderHistory enriches items with menu item data', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: '7d' });
    assert.ok(orders.length > 0);
    const firstOrder = orders[0]!;
    assert.ok(firstOrder.items.length > 0);
    const firstItem = firstOrder.items[0]!;
    assert.equal(firstItem.menuItemId, MENU_ITEM_ID);
    assert.equal(firstItem.price, 10.00);
    assert.ok(firstItem.menuItem, 'item should be enriched with menuItem data');
    assert.equal(firstItem.menuItem.name, 'Test Burger');
});

test('getOrderHistory enriches items with stationName', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: USER_ID, since: '7d' });
    assert.ok(orders.length > 0);
    const firstItem = orders[0]!.items[0]!;
    assert.equal(firstItem.stationName, 'Station', 'item should include station name');
});

test('getOrderHistory returns empty for unknown user', async () => {
    const orders = await getServices().data.order.getOrderHistory({ userId: 'nobody', since: 'all' });
    assert.equal(orders.length, 0);
});

test('getOrderMetrics counts orders keyed by menu item entityKey', async () => {
    const metrics = await OrderStorageClient.getOrderMetrics(METRICS_USER_ID);
    assert.equal(metrics.size, 2, 'should have one entry per distinct entityKey');
    assert.equal(metrics.get('name:test burger'), 3, 'ungrouped item keyed by name');
    assert.equal(metrics.get(`group:${GROUPED_MENU_ITEM_GROUP_ID}`), 2, 'grouped item keyed by group');
});

test('getOrderMetrics returns empty map for unknown user', async () => {
    const metrics = await OrderStorageClient.getOrderMetrics('nobody');
    assert.equal(metrics.size, 0);
});
