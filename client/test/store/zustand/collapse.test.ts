import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';
import {
    collapseCafe,
    collapseStation,
    expandCafe,
    expandStation,
    useCollapsedCafeIdsStore,
    useCollapsedStationIdsStore,
} from '../../../src/store/zustand/collapse.ts';

const resetStores = () => {
    useCollapsedCafeIdsStore.setState({ ids: new Set() });
    useCollapsedStationIdsStore.setState({ ids: new Set() });
};

describe('collapse stores', () => {
    beforeEach(resetStores);

    it('cafe add inserts an id', () => {
        collapseCafe('cafe-a');
        assert.ok(useCollapsedCafeIdsStore.getState().ids.has('cafe-a'));
    });

    it('cafe delete removes an id', () => {
        collapseCafe('cafe-a');
        expandCafe('cafe-a');
        assert.equal(useCollapsedCafeIdsStore.getState().ids.has('cafe-a'), false);
    });

    it('cafe add is a no-op for an existing id', () => {
        collapseCafe('cafe-a');
        const before = useCollapsedCafeIdsStore.getState().ids;
        collapseCafe('cafe-a');
        const after = useCollapsedCafeIdsStore.getState().ids;
        // mutative still produces a new set on each set() call; just make sure
        // the membership is unchanged.
        assert.equal(after.size, before.size);
        assert.ok(after.has('cafe-a'));
    });

    it('cafe delete is a no-op for a missing id', () => {
        expandCafe('cafe-missing');
        assert.equal(useCollapsedCafeIdsStore.getState().ids.size, 0);
    });

    it('clear empties the set', () => {
        collapseCafe('cafe-a');
        collapseCafe('cafe-b');
        useCollapsedCafeIdsStore.getState().clear();
        assert.equal(useCollapsedCafeIdsStore.getState().ids.size, 0);
    });

    it('station store is independent from cafe store', () => {
        collapseCafe('shared-id');
        collapseStation('shared-id');
        expandCafe('shared-id');

        assert.equal(useCollapsedCafeIdsStore.getState().ids.has('shared-id'), false);
        assert.ok(useCollapsedStationIdsStore.getState().ids.has('shared-id'));
    });

    it('multiple ids accumulate', () => {
        collapseStation('s1');
        collapseStation('s2');
        collapseStation('s3');

        const ids = useCollapsedStationIdsStore.getState().ids;
        assert.equal(ids.size, 3);
        assert.ok(ids.has('s1'));
        assert.ok(ids.has('s2'));
        assert.ok(ids.has('s3'));
    });

    it('expandStation removes the id', () => {
        collapseStation('s1');
        expandStation('s1');
        assert.equal(useCollapsedStationIdsStore.getState().ids.has('s1'), false);
    });
});
