import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SearchEntityType } from '@msdining/common/models/search';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { groupsService } from '../../../../main/services/data/groups.js';
import type { ICafe, ICafeConfig, ICafeStation } from '../../../../shared/models/cafe.js';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

let ctx: IntegrationTestContext;
let uniqueId = 0;

const nextId = (prefix: string) => `${prefix}-${++uniqueId}`;

const CAFE: ICafe = {
    id: 'groups-test-cafe',
    name: 'Groups Test Café',
};

const CONFIG: ICafeConfig = {
    tenantId: 'tenant-groups',
    contextId: 'context-groups',
    displayProfileId: 'display-groups',
    storeId: 'store-groups',
    externalName: 'Groups Test Cafe',
    isShutDown: false,
};

const STATION_A: ICafeStation = {
    id: 'groups-test-station-a',
    name: 'Groups Test Station A',
    menuId: 'groups-test-menu-a',
    cafeId: CAFE.id,
    groupId: null,
    logoUrl: 'https://example.com/groups-station-a.png',
    menuItemsById: new Map(),
    menuItemIdsByCategoryName: new Map(),
    opensAt: 0,
    closesAt: 0,
};

const STATION_B: ICafeStation = {
    id: 'groups-test-station-b',
    name: 'Groups Test Station B',
    menuId: 'groups-test-menu-b',
    cafeId: CAFE.id,
    groupId: null,
    logoUrl: 'https://example.com/groups-station-b.png',
    menuItemsById: new Map(),
    menuItemIdsByCategoryName: new Map(),
    opensAt: 0,
    closesAt: 0,
};

const MENU_ITEM_A: IMenuItemBase = {
    id: 'groups-test-menu-item-a',
    name: 'Groups Test Bowl A',
    description: 'First menu item for group service tests',
    cafeId: CAFE.id,
    stationId: STATION_A.id,
    groupId: null,
    price: 10,
    receiptText: 'GROUPS TEST BOWL A',
    calories: 500,
    maxCalories: 500,
    hasThumbnail: false,
    modifiers: [],
    tags: new Set(['vegan']),
    searchTags: new Set(['bowl']),
};

const MENU_ITEM_B: IMenuItemBase = {
    id: 'groups-test-menu-item-b',
    name: 'Groups Test Bowl B',
    description: 'Second menu item for group service tests',
    cafeId: CAFE.id,
    stationId: STATION_A.id,
    groupId: null,
    price: 11,
    receiptText: 'GROUPS TEST BOWL B',
    calories: 550,
    maxCalories: 550,
    hasThumbnail: false,
    modifiers: [],
    tags: new Set(['protein']),
    searchTags: new Set(['bowl']),
};

const MENU_ITEM_C: IMenuItemBase = {
    id: 'groups-test-menu-item-c',
    name: 'Groups Test Bowl C',
    description: 'Third menu item for group service tests',
    cafeId: CAFE.id,
    stationId: STATION_B.id,
    groupId: null,
    price: 12,
    receiptText: 'GROUPS TEST BOWL C',
    calories: 600,
    maxCalories: 600,
    hasThumbnail: false,
    modifiers: [],
    tags: new Set(['spicy']),
    searchTags: new Set(['bowl']),
};

before(async () => {
    ctx = await createIntegrationTestContext();

    await getServices().data.cafe.resetCache({});
    await getServices().data.cafe.createCafe({
        cafe: CAFE,
        config: CONFIG,
    });
    await getServices().data.station.createStation({ station: STATION_A });
    await getServices().data.station.createStation({ station: STATION_B });
    await getServices().data.menuItem.saveMenuItem({ menuItem: MENU_ITEM_A });
    await getServices().data.menuItem.saveMenuItem({ menuItem: MENU_ITEM_B });
    await getServices().data.menuItem.saveMenuItem({ menuItem: MENU_ITEM_C });
});

after(async () => {
    await ctx.cleanup();
});

const findGroupById = async (groupId: string) => {
    const groups = await getServices().data.groups.getGroups({});
    return groups.find(group => group.id === groupId) ?? null;
};

test('services.data.groups is the typed client', () => {
    assert.equal(getServices().data.groups, groupsService);
});

test('createGroup returns an object with id', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('menu-group'),
        entityType: SearchEntityType.menuItem,
        initialMembers: [MENU_ITEM_A.id],
    });

    assert.equal(typeof created.id, 'string');
    assert.notEqual(created.id, '');
});

test('getGroups includes the created group', async () => {

    const name = nextId('listed-group');
    const created = await getServices().data.groups.createGroup({
        name,
        entityType: SearchEntityType.menuItem,
        initialMembers: [MENU_ITEM_B.id],
    });

    const group = await findGroupById(created.id);

    assert.ok(group);
    assert.equal(group.name, name);
    assert.equal(group.type, SearchEntityType.menuItem);
});

test('getGroupMembers returns the members added during creation', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('members-group'),
        entityType: SearchEntityType.menuItem,
        initialMembers: [MENU_ITEM_A.id, MENU_ITEM_B.id],
    });

    const members = await getServices().data.groups.getGroupMembers({ groupId: created.id });

    assert.deepEqual(
        members.map(member => member.id).sort(),
        [MENU_ITEM_A.id, MENU_ITEM_B.id].sort(),
    );
});

test('addToGroup adds members to an existing group', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('add-members-group'),
        entityType: SearchEntityType.menuItem,
        initialMembers: [MENU_ITEM_A.id],
    });

    await getServices().data.groups.addToGroup({
        groupId: created.id,
        memberIds: [MENU_ITEM_B.id, MENU_ITEM_C.id],
    });

    const members = await getServices().data.groups.getGroupMembers({ groupId: created.id });

    assert.deepEqual(
        members.map(member => member.id).sort(),
        [MENU_ITEM_A.id, MENU_ITEM_B.id, MENU_ITEM_C.id].sort(),
    );
});

test('deleteMembersFromGroup removes members', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('delete-members-group'),
        entityType: SearchEntityType.menuItem,
        initialMembers: [MENU_ITEM_A.id, MENU_ITEM_B.id],
    });

    await getServices().data.groups.deleteMembersFromGroup({
        groupId: created.id,
        memberIds: [MENU_ITEM_B.id],
    });

    const members = await getServices().data.groups.getGroupMembers({ groupId: created.id });

    assert.deepEqual(members.map(member => member.id), [MENU_ITEM_A.id]);
});

test('deleteGroup removes the group', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('delete-group'),
        entityType: SearchEntityType.station,
        initialMembers: [STATION_A.id],
    });

    await getServices().data.groups.deleteGroup({ id: created.id });

    const group = await findGroupById(created.id);

    assert.equal(group, null);
});

test('updateGroup renames a group', async () => {

    const created = await getServices().data.groups.createGroup({
        name: nextId('rename-group'),
        entityType: SearchEntityType.station,
        initialMembers: [STATION_B.id],
    });
    const renamed = nextId('renamed-group');

    await getServices().data.groups.updateGroup({
        id: created.id,
        update: { name: renamed },
    });

    const group = await findGroupById(created.id);

    assert.ok(group);
    assert.equal(group.name, renamed);
});

/**
 * Regression: groups.ts#updateGroupIdForCachedMenuItems must mutate the
 * actual MenuItemStorageClient cache, not a structuredClone'd copy.
 * Before the fix, addToGroup/createGroup would update cloned objects
 * returned via the service, leaving the real cache with groupId: null.
 */
test('addToGroup updates the cached menu item groupId (regression: structuredClone isolation)', async () => {

    // Save a fresh menu item with no group.
    const itemId = nextId('cache-regression-item');
    const menuItem: IMenuItemBase = {
        ...MENU_ITEM_A,
        id:          itemId,
        name:        'Cache Regression Item',
        description: 'Tests that group assignment reaches the real cache',
        groupId:     null,
    };
    await getServices().data.menuItem.saveMenuItem({ menuItem });

    // Verify it starts with no group.
    const before = await getServices().data.menuItem.retrieveMenuItem({ id: itemId });
    assert.ok(before);
    assert.equal(before.groupId, null, 'item should start ungrouped');

    // Create a group with this item as an initial member.
    const group = await getServices().data.groups.createGroup({
        name:           nextId('cache-regression-group'),
        entityType:     SearchEntityType.menuItem,
        initialMembers: [itemId],
    });

    // The cached menu item's groupId should now reflect the group.
    const afterCreate = await getServices().data.menuItem.retrieveMenuItem({ id: itemId });
    assert.ok(afterCreate);
    assert.equal(afterCreate.groupId, group.id,
        'createGroup must update the cached menu item groupId (not a structuredClone)');

    // Also verify addToGroup updates another item's cache.
    const itemId2 = nextId('cache-regression-item-2');
    const menuItem2: IMenuItemBase = {
        ...MENU_ITEM_B,
        id:          itemId2,
        name:        'Cache Regression Item 2',
        description: 'Second item for addToGroup cache test',
        groupId:     null,
    };
    await getServices().data.menuItem.saveMenuItem({ menuItem: menuItem2 });
    await getServices().data.groups.addToGroup({ groupId: group.id, memberIds: [itemId2] });

    const afterAdd = await getServices().data.menuItem.retrieveMenuItem({ id: itemId2 });
    assert.ok(afterAdd);
    assert.equal(afterAdd.groupId, group.id,
        'addToGroup must update the cached menu item groupId');
});
