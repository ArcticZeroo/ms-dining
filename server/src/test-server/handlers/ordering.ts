/**
 * Ordering handlers: cart management, site data, pay config, close order,
 * wait time, and profit center lookup.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

/**
 * GET /sites/:contextId
 * Returns site data array for ordering context.
 */
function handleGetSiteData(req: TestRequest, state: ITestServerState): TestResponse {
    const siteData = state.getFixture<unknown[]>(req.cafeId, 'site-data');
    if (siteData) {
        return { status: 200, body: siteData };
    }

    return {
        status: 200,
        body: [
            {
                storePriceLevel: 'test-price-level-001',
                displayOptions: {
                    onDemandTerminalId: 'test-terminal-001',
                    onDemandEmployeeId: 'test-employee-001',
                    'profit-center-id': 'test-profit-center-001',
                    'check-type': 'test-check-type-001',
                },
                siteStoreInfo: {
                    businessContextId: 'test-context-001',
                    tenantId: 'test-tenant-001',
                },
            },
        ],
    };
}

/**
 * POST /sites/:contextId/:displayProfileId
 * Returns pay config with pay.clientId and display options.
 */
function handleGetPayConfig(req: TestRequest, state: ITestServerState): TestResponse {
    const payConfig = state.getFixture<unknown>(req.cafeId, 'pay-config');
    if (payConfig) {
        return { status: 200, body: payConfig };
    }

    return {
        status: 200,
        body: {
            pay: { clientId: 'test-pay-client-001' },
            displayOptions: {},
            pickUpConfig: {
                kitchenText: 'PICKUP',
                buttonText: 'PICKUP',
                defaultConfirmationText: 'Thank you for your order!',
            },
            emailReceipt: {},
            checkTypeId: 'test-check-type-001',
        },
    };
}

/**
 * POST /order/:tenantId/:contextId/orders
 * Adds items to cart / creates an order.
 */
function handleAddToOrder(req: TestRequest, state: ITestServerState): TestResponse {
    const body = req.body as { item?: { amount?: string; quantity?: number } } | undefined;

    // Find or create order for this cafe
    let order = Array.from(state.orders.values())
        .find(o => o.cafeId === req.cafeId && !o.closed);

    if (!order) {
        order = state.createOrder(req.cafeId);
    }

    const itemAmount = Number(body?.item?.amount ?? '0');
    const quantity = body?.item?.quantity ?? 1;
    const lineTotal = itemAmount * quantity;
    const tax = Math.round(lineTotal * 0.101 * 100) / 100; // ~10.1% tax

    const lineItemId = `line-item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    order.lineItems.push({ lineItemId });
    order.taxExcludedTotal += lineTotal;
    order.taxTotal += tax;
    order.totalDue += lineTotal + tax;

    return {
        status: 200,
        body: {
            orderDetails: {
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                created: new Date().toISOString(),
                taxExcludedTotalAmount: { amount: lineTotal.toFixed(2) },
                taxTotalAmount: { amount: tax.toFixed(2) },
                totalDueAmount: { amount: (lineTotal + tax).toFixed(2) },
                lineItems: order.lineItems,
            },
        },
    };
}

/**
 * POST /order/:tenantId/:contextId/getWaitTimeForItems
 * Returns estimated wait time.
 */
function handleGetWaitTime(req: TestRequest, state: ITestServerState): TestResponse {
    const waitTime = state.getFixture<{ minTime: number; maxTime: number }>(req.cafeId, 'wait-time');
    const minMinutes = waitTime?.minTime ?? 10;
    const maxMinutes = waitTime?.maxTime ?? 15;

    return {
        status: 200,
        body: {
            minTime: { minutes: minMinutes, fieldType: { name: 'minutes' }, periodType: { name: 'Minutes' } },
            maxTime: { minutes: maxMinutes, fieldType: { name: 'minutes' }, periodType: { name: 'Minutes' } },
        },
    };
}

/**
 * POST /order/:tenantId/:contextId/orderId/:orderId/processPaymentAndClosedOrder
 * Closes an order after payment.
 */
function handleCloseOrder(req: TestRequest, state: ITestServerState): TestResponse {
    const params = (req as any).params as Record<string, string>;
    const orderId = params.orderId;

    const order = orderId ? state.getOrderState(orderId) : undefined;
    if (!order) {
        return { status: 404, body: { error: `Order ${orderId} not found` } };
    }

    order.closed = true;

    return {
        status: 200,
        body: { success: true },
    };
}

/**
 * GET /sites/:tenantId/:contextId/profitCenter/:profitCenterId
 * Returns profit center name as plain text.
 */
function handleGetProfitCenter(req: TestRequest, _state: ITestServerState): TestResponse {
    const params = (req as any).params as Record<string, string>;
    const profitCenterId = params.profitCenterId ?? 'unknown';

    return {
        status: 200,
        rawBody: `Test Profit Center ${profitCenterId}`,
    };
}

export const orderingRoutes: RouteDefinition[] = [
    {
        method: 'GET',
        pattern: '/sites/:contextId',
        handler: handleGetSiteData,
    },
    {
        method: 'POST',
        pattern: '/sites/:contextId/:displayProfileId',
        handler: handleGetPayConfig,
    },
    {
        method: 'POST',
        pattern: '/order/:tenantId/:contextId/orders',
        handler: handleAddToOrder,
    },
    {
        method: 'POST',
        pattern: '/order/:tenantId/:contextId/getWaitTimeForItems',
        handler: handleGetWaitTime,
    },
    {
        method: 'POST',
        pattern: '/order/:tenantId/:contextId/orderId/:orderId/processPaymentAndClosedOrder',
        handler: handleCloseOrder,
    },
    {
        method: 'GET',
        pattern: '/sites/:tenantId/:contextId/profitCenter/:profitCenterId',
        handler: handleGetProfitCenter,
    },
];
