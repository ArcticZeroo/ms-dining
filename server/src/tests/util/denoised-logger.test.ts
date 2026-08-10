import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDenoisedCafeLogger } from '../../shared/util/denoised-logger.js';

describe('createDenoisedCafeLogger', () => {
    it('emits independent batches on successive intervals', (testContext) => {
        testContext.mock.timers.enable({ apis: ['setTimeout'] });

        const messages: unknown[][] = [];
        const logger = {
            info:  (...message: unknown[]) => messages.push(message),
            error: () => {},
            debug: () => {},
        };
        const logCafeUpdate = createDenoisedCafeLogger(logger, 'Daily menu published');

        logCafeUpdate({ cafeId: 'cafe-b', dateString: '2026-08-10' });
        logCafeUpdate({ cafeId: 'cafe-a', dateString: '2026-08-10' });
        logCafeUpdate({ cafeId: 'cafe-a', dateString: '2026-08-10' });

        testContext.mock.timers.tick(4_999);
        assert.equal(messages.length, 0);

        testContext.mock.timers.tick(1);
        assert.deepEqual(messages, [[
            'Daily menu published: \t- 2026-08-10: cafe-a, cafe-b (2)'
        ]]);

        logCafeUpdate({ cafeId: 'cafe-c', dateString: '2026-08-11' });
        testContext.mock.timers.tick(4_999);
        assert.equal(messages.length, 1);

        testContext.mock.timers.tick(1);
        assert.deepEqual(messages, [
            ['Daily menu published: \t- 2026-08-10: cafe-a, cafe-b (2)'],
            ['Daily menu published: \t- 2026-08-11: cafe-c (1)'],
        ]);
    });
});
