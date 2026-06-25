/**
 * Unit tests for buildReceiptItems — the pure positional mapping that pairs each
 * built cart item with the server-assigned lineItemId for the close-order
 * receipt. Kept separate from the full close flow (which needs iframe-token /
 * payment mocks) so positional correctness is proven directly.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { getEntityKeyFromParts } from '@msdining/common/util/entity-key';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { buildItemForCartAdd, buildReceiptItems } from './cart-item.js';
import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { ICafeConfig } from '../../../../../shared/models/cafe.js';
import { IStationRecord } from '../../../../../shared/services/station.js';
import { IEnhancedOrderItem } from '../../../../models/ordering.js';

const ORDERING_CONTEXT: IOrderingContext = {
    onDemandTerminalId: 'terminal-1',
    onDemandEmployeeId: 'employee-1',
    profitCenterId:     'pc-1',
    storePriceLevel:    'price-level-1',
    profitCenterName:   'Profit Center',
    payClientId:        'pay-client-1',
    fullSiteStoreInfo:  undefined,
    fullPickupConfig:   undefined,
};

const CAFE_CONFIG: ICafeConfig = {
    tenantId:         'tenant-1',
    contextId:        'context-1',
    displayProfileId: 'dp-1',
    storeId:          'store-1',
    externalName:     'Test Cafe',
    isShutDown:       false,
};

const STATION: IStationRecord = {
    id:             'station-1',
    name:           'Station',
    normalizedName: 'station',
    logoUrl:        null,
    menuId:         'menu-1',
    groupId:        null,
    cafeId:         'cafe-1',
    opensAt:        0,
    closesAt:       1440,
};

const makeOrderItem = (id: string, name: string): IEnhancedOrderItem => {
    const menuItem: IMenuItemBase = {
        id,
        cafeId:       'cafe-1',
        stationId:    STATION.id,
        price:        5,
        name,
        calories:     0,
        maxCalories:  0,
        hasThumbnail: false,
        modifiers:    [],
        tags:         new Set(),
        searchTags:   new Set(),
        entityKey:    getEntityKeyFromParts(undefined, normalizeNameForSearch(name)),
    };

    return {
        menuItemId:          id,
        quantity:            1,
        modifiers:           [],
        specialInstructions: '',
        menuItem,
        station:             STATION,
        cartGuid:            'cart-guid-shared',
        uniqueId:            `unique-${id}`,
    };
};

const buildCartItems = (count: number) =>
    Array.from({ length: count }, (_unused, index) => buildItemForCartAdd({
        orderItem:       makeOrderItem(`item-${index}`, `Item ${index}`),
        orderingContext: ORDERING_CONTEXT,
        cafeConfig:      CAFE_CONFIG,
        cartGuid:        'cart-guid-shared',
        uniqueId:        `unique-${index}`,
    }));

test('buildReceiptItems pairs each cart item with the lineItemId at the same index', () => {
    const cartItems = buildCartItems(3);
    const lineItems = [
        { lineItemId: 'line-0' },
        { lineItemId: 'line-1' },
        { lineItemId: 'line-2' },
    ];

    const receiptItems = buildReceiptItems(cartItems, lineItems);

    assert.equal(receiptItems.length, cartItems.length);
    receiptItems.forEach((receiptItem, index) => {
        assert.equal(receiptItem.lineItemId, lineItems[index]?.lineItemId, `item ${index} should map to lineItem ${index}`);
        assert.equal(receiptItem.languageCode, 'en');
        // Original cart item identity is preserved.
        assert.equal(receiptItem.uniqueId, `unique-${index}`);
        assert.equal(receiptItem.itemId, `item-${index}`);
    });
});

test('buildReceiptItems leaves lineItemId undefined when there are fewer line items', () => {
    const cartItems = buildCartItems(3);
    const lineItems = [{ lineItemId: 'line-0' }];

    const receiptItems = buildReceiptItems(cartItems, lineItems);

    assert.equal(receiptItems.length, 3);
    assert.equal(receiptItems[0]?.lineItemId, 'line-0');
    assert.equal(receiptItems[1]?.lineItemId, undefined);
    assert.equal(receiptItems[2]?.lineItemId, undefined);
});
