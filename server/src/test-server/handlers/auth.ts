/**
 * Auth handlers: login/anonymous and config endpoints.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

interface CafeConfigFixture {
    tenantID: string;
    contextID: string;
    theme: { logoImage: string };
    storeList: Array<{
        storeInfo: { storeInfoId: string; storeName: string };
        displayProfileId: string[];
    }>;
    properties?: {
        applicationShutOffConfig?: {
            isShutOffEnabled: boolean;
            instructionText?: string;
        };
    };
}

const DEFAULT_CONFIG: CafeConfigFixture = {
    tenantID: 'test-tenant-001',
    contextID: 'test-context-001',
    theme: { logoImage: 'test-logo.png' },
    storeList: [
        {
            storeInfo: {
                storeInfoId: 'test-store-001',
                storeName: 'Test Café',
            },
            displayProfileId: ['test-display-profile-001'],
        },
    ],
};

function handleLogin(_req: TestRequest, state: ITestServerState): TestResponse {
    const token = `test-access-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const csrfToken = `test-csrf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.issuedTokens.add(token);

    return {
        status: 200,
        headers: {
            'access-token': token,
        },
        body: { csrfToken },
    };
}

function handleConfig(req: TestRequest, state: ITestServerState): TestResponse {
    const config = state.getFixture<CafeConfigFixture>(req.cafeId, 'config') ?? DEFAULT_CONFIG;

    return {
        status: 200,
        body: config,
    };
}

export const authRoutes: RouteDefinition[] = [
    {
        method: 'GET',
        pattern: '/login/anonymous',
        handler: handleLogin,
    },
    {
        method: 'GET',
        pattern: '/config',
        handler: handleConfig,
    },
];
