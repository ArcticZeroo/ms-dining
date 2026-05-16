import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';
import { useCafesOnPageStore } from '../../../src/store/zustand/cafes-on-page.ts';

const reset = () => useCafesOnPageStore.setState({
    ids:          new Set(),
    refsByCafeId: new Map(),
});

describe('useCafesOnPageStore', () => {
    beforeEach(reset);

    it('addRef inserts the cafe into ids', () => {
        const sym = Symbol();
        useCafesOnPageStore.getState().addRef('cafe-a', sym);

        assert.ok(useCafesOnPageStore.getState().ids.has('cafe-a'));
        assert.equal(useCafesOnPageStore.getState().refsByCafeId.get('cafe-a')?.size, 1);
    });

    it('removeRef drops the cafe when its last ref leaves', () => {
        const sym = Symbol();
        const { addRef, removeRef } = useCafesOnPageStore.getState();
        addRef('cafe-a', sym);
        removeRef('cafe-a', sym);

        assert.equal(useCafesOnPageStore.getState().ids.has('cafe-a'), false);
        assert.equal(useCafesOnPageStore.getState().refsByCafeId.has('cafe-a'), false);
    });

    it('multiple refs ref-count the cafe', () => {
        const symA = Symbol();
        const symB = Symbol();
        const { addRef, removeRef } = useCafesOnPageStore.getState();
        addRef('cafe-a', symA);
        addRef('cafe-a', symB);
        removeRef('cafe-a', symA);

        // One ref remains, cafe stays in ids.
        assert.ok(useCafesOnPageStore.getState().ids.has('cafe-a'));

        removeRef('cafe-a', symB);
        assert.equal(useCafesOnPageStore.getState().ids.has('cafe-a'), false);
    });

    it('ids set identity is stable across ref-count-only updates', () => {
        const symA = Symbol();
        const symB = Symbol();
        const { addRef, removeRef } = useCafesOnPageStore.getState();

        addRef('cafe-a', symA);
        const idsAfterFirstAdd = useCafesOnPageStore.getState().ids;

        addRef('cafe-a', symB);
        const idsAfterSecondAdd = useCafesOnPageStore.getState().ids;

        assert.strictEqual(
            idsAfterFirstAdd,
            idsAfterSecondAdd,
            'ids identity must not change when only ref count grew'
        );

        removeRef('cafe-a', symB);
        const idsAfterFirstRemove = useCafesOnPageStore.getState().ids;

        assert.strictEqual(
            idsAfterSecondAdd,
            idsAfterFirstRemove,
            'ids identity must not change when only ref count shrunk but cafe remains'
        );

        removeRef('cafe-a', symA);
        const idsAfterFinalRemove = useCafesOnPageStore.getState().ids;

        assert.notStrictEqual(
            idsAfterFirstRemove,
            idsAfterFinalRemove,
            'ids identity must change when the cafe is genuinely removed'
        );
    });

    it('ids identity changes on first add of a cafe', () => {
        const idsAtStart = useCafesOnPageStore.getState().ids;
        useCafesOnPageStore.getState().addRef('cafe-a', Symbol());
        assert.notStrictEqual(idsAtStart, useCafesOnPageStore.getState().ids);
    });

    it('removeRef for an unknown cafe is a no-op', () => {
        useCafesOnPageStore.getState().removeRef('cafe-missing', Symbol());
        assert.equal(useCafesOnPageStore.getState().ids.size, 0);
    });

    it('different cafes are tracked independently', () => {
        const symA = Symbol();
        const symB = Symbol();
        const { addRef, removeRef } = useCafesOnPageStore.getState();
        addRef('cafe-a', symA);
        addRef('cafe-b', symB);

        assert.ok(useCafesOnPageStore.getState().ids.has('cafe-a'));
        assert.ok(useCafesOnPageStore.getState().ids.has('cafe-b'));

        removeRef('cafe-a', symA);
        assert.equal(useCafesOnPageStore.getState().ids.has('cafe-a'), false);
        assert.ok(useCafesOnPageStore.getState().ids.has('cafe-b'));
    });
});
