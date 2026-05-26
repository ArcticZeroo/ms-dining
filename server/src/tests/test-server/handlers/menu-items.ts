/**
 * Menu item handlers: bulk get-items and single item detail/modifiers.
 */

import { RouteDefinition, TestRequest, TestResponse, ITestServerState } from '../models.js';

interface MenuItemFixture {
    id: string;
    amount: string;
    displayText: string;
    properties: {
        calories: string;
        maxCalories: string;
    };
    image?: string;
    description?: string;
    lastUpdateTime: string;
    isItemCustomizationEnabled?: boolean;
    tagIds?: string[];
    receiptText: string;
    priceLevels: Record<string, {
        priceLevelId: string;
        name: string;
        price: { currencyUnit: string; amount: string };
    }>;
    /** Generated modifier data — used by kiosk-items/:itemId detail endpoint */
    _modifiers?: {
        modifiers?: Array<{
            id: string;
            description: string;
            minimum: number;
            maximum: number;
            type: string;
            options: Array<{ id: string; description: string; amount: string }>;
        }>;
    };
}

interface MenuItemDetailFixture {
    id: string;
    contextId: string;
    tenantId: string;
    itemId: string;
    name: string;
    displayText: string;
    amount: string;
    price: { currencyUnit: string; amount: string };
    menuId: string;
    menuPriceLevelId: string;
    menuPriceLevelApplied: boolean;
    receiptText: string;
    kpText: string;
    kitchenDisplayText: string;
    properties?: Record<string, unknown>;
    modifiers?: {
        modifiers?: Array<{
            id: string;
            description: string;
            minimum: number;
            maximum: number;
            type: string;
            options: Array<{
                id: string;
                description: string;
                amount: string;
            }>;
        }>;
    };
}

const DEFAULT_MENU_ITEMS: MenuItemFixture[] = [
    {
        id: 'item-1',
        amount: '9.99',
        displayText: 'Test Burger',
        properties: { calories: '650', maxCalories: '800' },
        description: 'A delicious test burger',
        lastUpdateTime: new Date().toISOString(),
        receiptText: 'TEST BURGER',
        tagIds: ['tag-1'],
        priceLevels: {
            'price-level-1': {
                priceLevelId: 'price-level-1',
                name: 'Default',
                price: { currencyUnit: 'USD', amount: '9.99' },
            },
        },
    },
    {
        id: 'item-2',
        amount: '12.50',
        displayText: 'Test Salad',
        properties: { calories: '350', maxCalories: '400' },
        description: 'A fresh test salad',
        lastUpdateTime: new Date().toISOString(),
        isItemCustomizationEnabled: true,
        receiptText: 'TEST SALAD',
        priceLevels: {
            'price-level-1': {
                priceLevelId: 'price-level-1',
                name: 'Default',
                price: { currencyUnit: 'USD', amount: '12.50' },
            },
        },
    },
    {
        id: 'item-3',
        amount: '3.50',
        displayText: 'Test Soda',
        properties: { calories: '150', maxCalories: '150' },
        lastUpdateTime: new Date().toISOString(),
        receiptText: 'TEST SODA',
        priceLevels: {
            'price-level-1': {
                priceLevelId: 'price-level-1',
                name: 'Default',
                price: { currencyUnit: 'USD', amount: '3.50' },
            },
        },
    },
];

function getDefaultItemDetail(item: MenuItemFixture): MenuItemDetailFixture {
    return {
        id: item.id,
        contextId: 'test-context-001',
        tenantId: 'test-tenant-001',
        itemId: item.id,
        name: item.receiptText,
        displayText: item.displayText,
        amount: item.amount,
        price: { currencyUnit: 'USD', amount: item.amount },
        menuId: 'menu-1',
        menuPriceLevelId: 'price-level-1',
        menuPriceLevelApplied: false,
        receiptText: item.receiptText,
        kpText: item.receiptText,
        kitchenDisplayText: item.displayText,
        modifiers: item._modifiers ?? (item.isItemCustomizationEnabled ? {
            modifiers: [
                {
                    id: `${item.id}-mod-fallback`,
                    description: 'Dressing',
                    minimum: 0,
                    maximum: 1,
                    type: 'radio',
                    options: [
                        { id: `${item.id}-opt-1`, description: 'Ranch', amount: '0.00' },
                        { id: `${item.id}-opt-2`, description: 'Vinaigrette', amount: '0.00' },
                    ],
                },
            ],
        } : undefined),
    };
}

/**
 * POST /sites/:tenantId/:contextId/kiosk-items/get-items
 * Returns menu items matching the requested IDs.
 */
function handleGetItems(req: TestRequest, state: ITestServerState): TestResponse {
    const allItems = state.getFixture<MenuItemFixture[]>(req.cafeId, 'menu-items') ?? DEFAULT_MENU_ITEMS;
    const body = req.body as { itemIds?: string[] } | undefined;
    const requestedIds = body?.itemIds;

    let items: MenuItemFixture[];
    if (requestedIds && requestedIds.length > 0) {
        const idSet = new Set(requestedIds);
        items = allItems.filter(item => idSet.has(item.id));
    } else {
        // If no IDs specified, return all items
        items = allItems;
    }

    return {
        status: 200,
        body: items,
    };
}

/**
 * POST /sites/:tenantId/:contextId/kiosk-items/:itemId
 * Returns detail for a single item (including modifiers for ordering).
 */
function handleGetItemDetail(req: TestRequest, state: ITestServerState): TestResponse {
    const params = (req as any).params as Record<string, string>;
    const itemId = params.itemId;

    // Check for per-item detail fixtures first
    const detailFixtures = state.getFixture<Record<string, MenuItemDetailFixture>>(req.cafeId, 'menu-item-details');
    if (detailFixtures && itemId && detailFixtures[itemId]) {
        return { status: 200, body: detailFixtures[itemId] };
    }

    // Fall back to generating detail from the menu items list
    const allItems = state.getFixture<MenuItemFixture[]>(req.cafeId, 'menu-items') ?? DEFAULT_MENU_ITEMS;
    const item = allItems.find(i => i.id === itemId);

    if (!item) {
        return { status: 404, body: { error: `Item ${itemId} not found` } };
    }

    return {
        status: 200,
        body: getDefaultItemDetail(item),
    };
}

export const menuItemRoutes: RouteDefinition[] = [
    {
        method: 'POST',
        pattern: '/sites/:tenantId/:contextId/kiosk-items/get-items',
        handler: handleGetItems,
    },
    {
        method: 'POST',
        pattern: '/sites/:tenantId/:contextId/kiosk-items/:itemId',
        handler: handleGetItemDetail,
    },
];
