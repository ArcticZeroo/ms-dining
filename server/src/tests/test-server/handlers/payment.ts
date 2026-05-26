/**
 * Payment and communication handlers: iFrame token, log iframe data, SMS receipt.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

/**
 * POST /iFrame/token/:tenantId
 * Returns a payment iframe token.
 */
function handleGetIframeToken(_req: TestRequest, _state: ITestServerState): TestResponse {
    const token = `test-iframe-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return {
        status: 200,
        body: { token },
    };
}

/**
 * POST /order/logIframeData
 * Logs iframe payment data (fire-and-forget).
 */
function handleLogIframeData(_req: TestRequest, _state: ITestServerState): TestResponse {
    return {
        status: 200,
        body: { success: true },
    };
}

/**
 * POST /communication/sendSMSReceipt
 * Sends SMS receipt confirmation.
 */
function handleSendSmsReceipt(_req: TestRequest, _state: ITestServerState): TestResponse {
    return {
        status: 200,
        body: { success: true },
    };
}

export const paymentRoutes: RouteDefinition[] = [
    {
        method: 'POST',
        pattern: '/iFrame/token/:tenantId',
        handler: handleGetIframeToken,
    },
    {
        method: 'POST',
        pattern: '/order/logIframeData',
        handler: handleLogIframeData,
    },
    {
        method: 'POST',
        pattern: '/communication/sendSMSReceipt',
        handler: handleSendSmsReceipt,
    },
];
