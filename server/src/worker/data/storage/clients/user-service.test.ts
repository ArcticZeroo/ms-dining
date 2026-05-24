import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { userService } from '../../../../main/services/data/user.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

test('services.data.user is the typed client (not the storage class)', () => {
    assert.equal(getServices().data.user, userService);
});

test('createUser + getUser round-trip', async () => {
    const userInput = {
        displayName: 'Round Trip User',
        externalId: `external-${randomUUID()}`,
        provider: 'test-provider',
    };

    const createdUser = await getServices().data.user.createUser({ user: userInput });
    const retrievedUser = await getServices().data.user.getUser({ id: createdUser.id });

    assert.ok(retrievedUser);
    assert.equal(retrievedUser.id, createdUser.id);
    assert.equal(retrievedUser.displayName, userInput.displayName);
    assert.equal(retrievedUser.externalId, userInput.externalId);
    assert.equal(retrievedUser.provider, userInput.provider);
    assert.equal(retrievedUser.role, createdUser.role);
});

test('getUser returns null for nonexistent id', async () => {
    const user = await getServices().data.user.getUser({ id: `missing-${randomUUID()}` });
    assert.equal(user, null);
});

test('updateUserDisplayName changes the display name', async () => {
    const createdUser = await getServices().data.user.createUser({
        user: {
            displayName: 'Original Name',
            externalId: `external-${randomUUID()}`,
            provider: 'test-provider',
        },
    });

    await getServices().data.user.updateUserDisplayName({
        id: createdUser.id,
        displayName: 'Updated Name',
    });

    const updatedUser = await getServices().data.user.getUser({ id: createdUser.id });
    assert.ok(updatedUser);
    assert.equal(updatedUser.displayName, 'Updated Name');
});

test('updateUserSettings persists favorites', async () => {
    const createdUser = await getServices().data.user.createUser({
        user: {
            displayName: 'Settings User',
            externalId: `external-${randomUUID()}`,
            provider: 'test-provider',
        },
    });
    const timestamp = Date.now();
    const settings = {
        favoriteStations: ['station-1', 'station-2'],
        favoriteMenuItems: ['menu-item-1', 'menu-item-2'],
        homepageIds: ['home-1', 'home-2'],
        timestamp,
    };

    await getServices().data.user.updateUserSettings({
        id: createdUser.id,
        settings,
    });

    const updatedUser = await getServices().data.user.getUser({ id: createdUser.id });
    assert.ok(updatedUser);
    assert.ok(updatedUser.settings);
    assert.deepEqual(updatedUser.settings.favoriteStations, settings.favoriteStations);
    assert.deepEqual(updatedUser.settings.favoriteMenuItems, settings.favoriteMenuItems);
    assert.deepEqual(updatedUser.settings.homepageIds, settings.homepageIds);
    assert.equal(updatedUser.settings.lastUpdate.getTime(), timestamp);
});

test('createUser with duplicate externalId+provider returns existing user', async () => {
    const externalId = `external-${randomUUID()}`;
    const provider = 'duplicate-provider';

    const firstUser = await getServices().data.user.createUser({
        user: {
            displayName: 'First Name',
            externalId,
            provider,
        },
    });

    const secondUser = await getServices().data.user.createUser({
        user: {
            displayName: 'Second Name',
            externalId,
            provider,
        },
    });

    assert.equal(secondUser.id, firstUser.id);
    assert.equal(secondUser.externalId, firstUser.externalId);
    assert.equal(secondUser.provider, firstUser.provider);
    assert.equal(secondUser.displayName, firstUser.displayName);
});
