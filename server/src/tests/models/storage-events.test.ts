import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    hasAnythingChangedInPublishedMenu,
    IMenuPublishEvent,
} from '../../shared/models/storage-events.js';

const makeEvent = (overrides: Partial<IMenuPublishEvent> = {}): IMenuPublishEvent => ({
    cafe:                      { id: 'cafe-test', name: 'Test Cafe' },
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

describe('hasAnythingChangedInPublishedMenu', () => {
    // Regression coverage: this helper previously had its return value
    // inverted (returned true when both dirty sets were *empty*), which
    // silently broke every consumer that gated on "skip when nothing
    // changed". Tests pin the now-correct semantics.

    it('returns false when both dirty sets are empty', () => {
        assert.equal(hasAnythingChangedInPublishedMenu(makeEvent()), false);
    });

    it('returns true when any station is dirty', () => {
        assert.equal(
            hasAnythingChangedInPublishedMenu(makeEvent({
                dirtyStations: new Set(['station-1']),
            })),
            true,
        );
    });

    it('returns true when any menu item is dirty', () => {
        assert.equal(
            hasAnythingChangedInPublishedMenu(makeEvent({
                dirtyMenuItemIds: new Set(['item-1']),
            })),
            true,
        );
    });

    it('returns true when both dirty sets are populated', () => {
        assert.equal(
            hasAnythingChangedInPublishedMenu(makeEvent({
                dirtyStations:    new Set(['station-1', 'station-2']),
                dirtyMenuItemIds: new Set(['item-1']),
            })),
            true,
        );
    });
});
