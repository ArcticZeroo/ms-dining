/**
 * Unit tests for the menu watermark cache (api/cache/menu-watermark.ts).
 *
 * The watermark module subscribes to CACHE_EVENTS.menuPublished at module
 * load. Side-effect imports are fine here because there's no production
 * data being mutated — the module's only state is an in-memory map keyed
 * by `${cafeId}@${dateString}`.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { getMenuWatermark } from '../../../api/cache/menu-watermark.js';
import { CACHE_EVENTS } from '../../../api/storage/events.js';
import { IMenuPublishEvent } from '../../../models/storage-events.js';

const SERVER_START_CAPTURED_AT = Date.now();

const makePublishEvent = (overrides: Partial<IMenuPublishEvent>): IMenuPublishEvent => ({
    cafe:                      { id: 'cafe-w', name: 'Watermark Test Cafe' },
    dateString:                '2026-05-13',
    isAvailable:               true,
    menu:                      [],
    addedStations:             new Set(),
    removedStations:           new Set(),
    updatedStations:           new Set(),
    dirtyStations:             new Set(),
    removedMenuItemsByStation: new Map(),
    addedMenuItemsByStation:   new Map(),
    dirtyMenuItemIds:          new Set(),
    ...overrides,
});

describe('getMenuWatermark', () => {
    // Coverage gap that caused a real production bug: post-restart, when
    // the DB already has today's menus, the boot flow skips re-sync so
    // no menuPublished events fire. The watermark map stayed empty and
    // the middleware silently emitted no ETag header. These tests pin
    // the fallback behavior so that doesn't regress.

    it('falls back to a stable positive timestamp for never-published cafe-days', () => {
        const value = getMenuWatermark('never-published-cafe', '2099-01-01');
        assert.ok(Number.isFinite(value), `expected number, got ${value}`);
        // SERVER_START_MS is captured at module load. This test was set up
        // after that, so the fallback can't be in the future.
        assert.ok(value > 0);
        assert.ok(value <= SERVER_START_CAPTURED_AT);
    });

    it('returns the same fallback on repeat calls (stable within a server lifetime)', () => {
        const first = getMenuWatermark('never-published-cafe-2', '2099-01-01');
        const second = getMenuWatermark('never-published-cafe-2', '2099-01-01');
        assert.equal(first, second);
    });

    it('different cafe-days share the same fallback', () => {
        const a = getMenuWatermark('fallback-a', '2099-01-01');
        const b = getMenuWatermark('fallback-b', '2099-01-02');
        assert.equal(a, b);
    });

    it('returns the published timestamp once a real change fires', () => {
        const cafeId = 'cafe-published';
        const dateString = '2099-06-15';
        const fallbackBefore = getMenuWatermark(cafeId, dateString);

        const event = makePublishEvent({
            cafe:             { id: cafeId, name: 'Published Cafe' },
            dateString,
            dirtyMenuItemIds: new Set(['item-x']),
        });
        const beforeEmit = Date.now();
        CACHE_EVENTS.emit('menuPublished', event);
        const afterEmit = Date.now();

        const stamped = getMenuWatermark(cafeId, dateString);
        assert.ok(stamped >= beforeEmit && stamped <= afterEmit,
            `stamped (${stamped}) should be within [${beforeEmit}, ${afterEmit}]`);
        assert.notEqual(stamped, fallbackBefore,
            'publishing should advance the watermark off the fallback');
    });

    it('ignores publish events with empty dirty sets', () => {
        const cafeId = 'cafe-noop';
        const dateString = '2099-06-16';
        const fallback = getMenuWatermark(cafeId, dateString);

        CACHE_EVENTS.emit('menuPublished', makePublishEvent({
            cafe: { id: cafeId, name: 'No-op Cafe' },
            dateString,
        }));

        assert.equal(getMenuWatermark(cafeId, dateString), fallback,
            'no-op publish must not advance the watermark');
    });
});
