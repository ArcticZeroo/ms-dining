import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../shared/services/registry.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

test('get returns undefined for nonexistent session', async () => {
    const session = await getServices().data.session.get({ sessionId: `missing-${randomUUID()}` });
    assert.equal(session, undefined);
});

test('set + get round-trip', async () => {
    const sessionId = `session-${randomUUID()}`;
    const user = await getServices().data.user.createUser({
        user: {
            displayName: 'Session User',
            externalId: `external-${randomUUID()}`,
            provider: 'session-test-provider',
        },
    });
    const sessionData = {
        passport: {
            user: user.id,
        },
    };

    await getServices().data.session.set({
        sessionId,
        sessionData,
        maxAge: 60_000,
    });

    const storedSession = await getServices().data.session.get({ sessionId });
    assert.deepEqual(storedSession, sessionData);
});

test('destroy removes a session', async () => {
    const sessionId = `session-${randomUUID()}`;
    const user = await getServices().data.user.createUser({
        user: {
            displayName: 'Destroy Session User',
            externalId: `external-${randomUUID()}`,
            provider: 'session-test-provider',
        },
    });

    await getServices().data.session.set({
        sessionId,
        sessionData: {
            passport: {
                user: user.id,
            },
        },
        maxAge: 60_000,
    });

    await getServices().data.session.destroy({ sessionId });

    const session = await getServices().data.session.get({ sessionId });
    assert.equal(session, undefined);
});

test('set without passport.user data is a no-op', async () => {
    const sessionId = `session-${randomUUID()}`;

    await getServices().data.session.set({
        sessionId,
        sessionData: {
            passport: {},
        },
        maxAge: 60_000,
    });

    const session = await getServices().data.session.get({ sessionId });
    assert.equal(session, undefined);
});
