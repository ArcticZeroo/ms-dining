import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDbPriority, runWithDbPriority } from './db-context.js';

describe('db-context', () => {
    it('should default to background when no context is set', () => {
        assert.equal(getDbPriority(), 'background');
    });

    it('should return the set priority inside runWithDbPriority', () => {
        runWithDbPriority('normal', () => {
            assert.equal(getDbPriority(), 'normal');
        });

        runWithDbPriority('critical', () => {
            assert.equal(getDbPriority(), 'critical');
        });
    });

    it('should not downgrade from a higher priority', () => {
        runWithDbPriority('critical', () => {
            runWithDbPriority('normal', () => {
                assert.equal(getDbPriority(), 'critical');
            });
            runWithDbPriority('background', () => {
                assert.equal(getDbPriority(), 'critical');
            });
        });
    });

    it('should not downgrade from normal to background', () => {
        runWithDbPriority('normal', () => {
            runWithDbPriority('background', () => {
                assert.equal(getDbPriority(), 'normal');
            });
        });
    });

    it('should allow upgrading from a lower priority', () => {
        runWithDbPriority('background', () => {
            runWithDbPriority('normal', () => {
                assert.equal(getDbPriority(), 'normal');
            });
            // After the inner run exits, the outer context is restored
            assert.equal(getDbPriority(), 'background');
        });
    });

    it('should allow upgrading from normal to critical', () => {
        runWithDbPriority('normal', () => {
            runWithDbPriority('critical', () => {
                assert.equal(getDbPriority(), 'critical');
            });
            assert.equal(getDbPriority(), 'normal');
        });
    });

    it('should restore context after runWithDbPriority exits', () => {
        runWithDbPriority('critical', () => {
            // inside critical
        });
        assert.equal(getDbPriority(), 'background');
    });

    it('should keep same priority when setting equal level', () => {
        runWithDbPriority('normal', () => {
            runWithDbPriority('normal', () => {
                assert.equal(getDbPriority(), 'normal');
            });
        });
    });
});
