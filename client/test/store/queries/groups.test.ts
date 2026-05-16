import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { SearchEntityType } from '@msdining/common/models/search';
import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { AllItemsWithoutGroupByType } from '../../../src/models/groups.ts';
import {
    buildItemsWithoutGroupByNormalizedName,
    patchCandidatesAcceptInto,
    patchCandidatesRemoveAcceptedMembers,
    patchGroupAddMembers,
    patchGroupCreate,
    patchGroupDelete,
    patchGroupRemoveMember,
    patchGroupUpdate,
    patchItemsWithoutGroupAdd,
    patchItemsWithoutGroupRemove,
    toGroupMap,
    toItemsWithoutGroupByType,
} from '../../../src/store/queries/groups.ts';

const makeMember = (overrides: Partial<IGroupMember> = {}): IGroupMember => ({
    id:           'member-1',
    name:         'Member 1',
    type:         SearchEntityType.menuItem,
    cafeId:       'cafe-1',
    ...overrides,
});

const makeGroup = (overrides: Partial<IGroupData> = {}): IGroupData => ({
    id:      'group-1',
    name:    'Group 1',
    type:    SearchEntityType.menuItem,
    members: [],
    ...overrides,
});

describe('toGroupMap', () => {
    it('produces an empty map for an empty list', () => {
        assert.strictEqual(toGroupMap([]).size, 0);
    });

    it('indexes by group id', () => {
        const map = toGroupMap([makeGroup({ id: 'g-a' }), makeGroup({ id: 'g-b' })]);
        assert.strictEqual(map.size, 2);
        assert.strictEqual(map.get('g-a')?.id, 'g-a');
        assert.strictEqual(map.get('g-b')?.id, 'g-b');
    });
});

describe('toItemsWithoutGroupByType', () => {
    it('produces an empty map for an empty list', () => {
        assert.strictEqual(toItemsWithoutGroupByType([]).size, 0);
    });

    it('groups items by entity type and indexes by id', () => {
        const result = toItemsWithoutGroupByType([
            makeMember({ id: 'a', type: SearchEntityType.menuItem }),
            makeMember({ id: 'b', type: SearchEntityType.menuItem }),
            makeMember({ id: 'c', type: SearchEntityType.station }),
        ]);
        assert.strictEqual(result.get(SearchEntityType.menuItem)?.size, 2);
        assert.strictEqual(result.get(SearchEntityType.station)?.size, 1);
        assert.strictEqual(result.get(SearchEntityType.menuItem)?.get('a')?.id, 'a');
    });
});

describe('buildItemsWithoutGroupByNormalizedName', () => {
    it('groups items by lowercased name across types', () => {
        const items: AllItemsWithoutGroupByType = new Map([
            [SearchEntityType.menuItem, new Map([
                ['a', makeMember({ id: 'a', name: 'Burger' })],
                ['b', makeMember({ id: 'b', name: 'burger' })],
                ['c', makeMember({ id: 'c', name: 'Pizza' })],
            ])],
        ]);

        const result = buildItemsWithoutGroupByNormalizedName(items);

        assert.strictEqual(result.get('burger')?.length, 2);
        assert.strictEqual(result.get('pizza')?.length, 1);
    });

    it('returns an empty map for empty input', () => {
        assert.strictEqual(buildItemsWithoutGroupByNormalizedName(new Map()).size, 0);
    });
});

describe('patchGroupUpdate', () => {
    it('updates name and notes when both are provided', () => {
        const groups = toGroupMap([makeGroup({ name: 'old', notes: 'old-notes' })]);
        const next = patchGroupUpdate(groups, 'group-1', { name: 'new', notes: 'new-notes' });

        assert.strictEqual(next.get('group-1')?.name, 'new');
        assert.strictEqual(next.get('group-1')?.notes, 'new-notes');
    });

    it('only updates fields present in the request', () => {
        const groups = toGroupMap([makeGroup({ name: 'old', notes: 'old-notes' })]);
        const next = patchGroupUpdate(groups, 'group-1', { name: 'new' });

        assert.strictEqual(next.get('group-1')?.name, 'new');
        assert.strictEqual(next.get('group-1')?.notes, 'old-notes');
    });

    it('returns the input unchanged when the group is unknown', () => {
        const groups = toGroupMap([makeGroup()]);
        const next = patchGroupUpdate(groups, 'unknown', { name: 'x' });
        assert.strictEqual(next, groups);
    });

    it('does not mutate the input', () => {
        const groups = toGroupMap([makeGroup({ name: 'old' })]);
        patchGroupUpdate(groups, 'group-1', { name: 'new' });
        assert.strictEqual(groups.get('group-1')?.name, 'old');
    });
});

describe('patchGroupRemoveMember', () => {
    const memberA = makeMember({ id: 'a' });
    const memberB = makeMember({ id: 'b' });

    it('removes the named member and reports it as removed', () => {
        const groups = toGroupMap([makeGroup({ members: [memberA, memberB] })]);

        const { groups: next, removedMembers } = patchGroupRemoveMember(groups, 'group-1', 'a');

        assert.strictEqual(next.get('group-1')?.members.length, 1);
        assert.strictEqual(next.get('group-1')?.members[0]?.id, 'b');
        assert.deepStrictEqual(removedMembers, [memberA]);
    });

    it('returns the input unchanged when the member is not in the group', () => {
        const groups = toGroupMap([makeGroup({ members: [memberB] })]);
        const { groups: next, removedMembers } = patchGroupRemoveMember(groups, 'group-1', 'a');

        assert.strictEqual(next, groups);
        assert.strictEqual(removedMembers.length, 0);
    });

    it('returns the input unchanged when the group is unknown', () => {
        const groups = toGroupMap([makeGroup()]);
        const { groups: next, removedMembers } = patchGroupRemoveMember(groups, 'unknown', 'a');

        assert.strictEqual(next, groups);
        assert.strictEqual(removedMembers.length, 0);
    });
});

describe('patchGroupDelete', () => {
    const memberA = makeMember({ id: 'a' });

    it('removes the group and reports its members as removed', () => {
        const groups = toGroupMap([makeGroup({ members: [memberA] })]);

        const { groups: next, removedMembers } = patchGroupDelete(groups, 'group-1');

        assert.strictEqual(next.has('group-1'), false);
        assert.deepStrictEqual(removedMembers, [memberA]);
    });

    it('returns the input unchanged when the group is unknown', () => {
        const groups = toGroupMap([makeGroup()]);
        const { groups: next, removedMembers } = patchGroupDelete(groups, 'unknown');

        assert.strictEqual(next, groups);
        assert.strictEqual(removedMembers.length, 0);
    });
});

describe('patchGroupAddMembers', () => {
    const memberA = makeMember({ id: 'a' });
    const memberB = makeMember({ id: 'b' });

    it('appends new members to the group', () => {
        const groups = toGroupMap([makeGroup({ members: [memberA] })]);

        const next = patchGroupAddMembers(groups, 'group-1', [memberB]);

        assert.strictEqual(next.get('group-1')?.members.length, 2);
        assert.deepStrictEqual(next.get('group-1')?.members.map((member) => member.id), ['a', 'b']);
    });

    it('deduplicates: existing members with the same id are replaced', () => {
        const oldA = makeMember({ id: 'a', name: 'Old A' });
        const newA = makeMember({ id: 'a', name: 'New A' });
        const groups = toGroupMap([makeGroup({ members: [oldA] })]);

        const next = patchGroupAddMembers(groups, 'group-1', [newA]);

        assert.strictEqual(next.get('group-1')?.members.length, 1);
        assert.strictEqual(next.get('group-1')?.members[0]?.name, 'New A');
    });

    it('returns the input unchanged when the group is unknown', () => {
        const groups = toGroupMap([makeGroup()]);
        const next = patchGroupAddMembers(groups, 'unknown', [memberA]);
        assert.strictEqual(next, groups);
    });
});

describe('patchGroupCreate', () => {
    it('adds a new group entry', () => {
        const groups = toGroupMap([makeGroup({ id: 'g-a' })]);
        const newGroup = makeGroup({ id: 'g-b', name: 'B' });

        const next = patchGroupCreate(groups, newGroup);

        assert.strictEqual(next.size, 2);
        assert.strictEqual(next.get('g-b')?.name, 'B');
    });
});

describe('patchCandidatesRemoveAcceptedMembers', () => {
    const memberA = makeMember({ id: 'a' });
    const memberB = makeMember({ id: 'b' });
    const memberC = makeMember({ id: 'c' });

    it('removes accepted members from candidates that still have remaining members', () => {
        const candidates = toGroupMap([makeGroup({ id: 'cand-1', members: [memberA, memberB, memberC] })]);

        const next = patchCandidatesRemoveAcceptedMembers(candidates, new Set(['a', 'b']));

        assert.strictEqual(next.get('cand-1')?.members.length, 1);
        assert.strictEqual(next.get('cand-1')?.members[0]?.id, 'c');
    });

    it('deletes candidates that become empty', () => {
        const candidates = toGroupMap([makeGroup({ id: 'cand-1', members: [memberA, memberB] })]);

        const next = patchCandidatesRemoveAcceptedMembers(candidates, new Set(['a', 'b']));

        assert.strictEqual(next.has('cand-1'), false);
    });

    it('returns the input unchanged when no candidates touch the accepted ids', () => {
        const candidates = toGroupMap([makeGroup({ id: 'cand-1', members: [memberA] })]);

        const next = patchCandidatesRemoveAcceptedMembers(candidates, new Set(['unrelated']));

        assert.strictEqual(next, candidates);
    });
});

describe('patchCandidatesAcceptInto', () => {
    const memberA = makeMember({ id: 'a' });
    const memberB = makeMember({ id: 'b' });
    const memberC = makeMember({ id: 'c' });

    it('removes the candidate entirely when every member was accepted', () => {
        const candidate = makeGroup({ id: 'cand-1', members: [memberA, memberB] });
        const candidates = toGroupMap([candidate]);

        const next = patchCandidatesAcceptInto(candidates, candidate, new Set(['a', 'b']));

        assert.strictEqual(next.has('cand-1'), false);
        assert.strictEqual(next.size, 0);
    });

    it('replaces the candidate with a remainder candidate when some members were rejected', () => {
        const candidate = makeGroup({ id: 'cand-1', members: [memberA, memberB, memberC] });
        const candidates = toGroupMap([candidate]);

        const next = patchCandidatesAcceptInto(candidates, candidate, new Set(['a']));

        assert.strictEqual(next.has('cand-1'), false);
        assert.strictEqual(next.size, 1);
        const remainder = Array.from(next.values())[0];
        assert.strictEqual(remainder?.members.length, 2);
        assert.deepStrictEqual(remainder?.members.map((member) => member.id).sort(), ['b', 'c']);
        assert.notStrictEqual(remainder?.id, 'cand-1');
    });
});

describe('patchItemsWithoutGroupRemove', () => {
    const memberA = makeMember({ id: 'a', type: SearchEntityType.menuItem });
    const memberB = makeMember({ id: 'b', type: SearchEntityType.menuItem });

    it('removes members from their corresponding type buckets', () => {
        const items = toItemsWithoutGroupByType([memberA, memberB]);

        const next = patchItemsWithoutGroupRemove(items, [memberA]);

        assert.strictEqual(next.get(SearchEntityType.menuItem)?.size, 1);
        assert.strictEqual(next.get(SearchEntityType.menuItem)?.has('a'), false);
    });

    it('returns the input unchanged when no members are removed', () => {
        const items = toItemsWithoutGroupByType([memberA]);

        const next = patchItemsWithoutGroupRemove(items, []);

        assert.strictEqual(next, items);
    });

    it('does not mutate the input', () => {
        const items = toItemsWithoutGroupByType([memberA]);
        patchItemsWithoutGroupRemove(items, [memberA]);
        assert.strictEqual(items.get(SearchEntityType.menuItem)?.has('a'), true);
    });
});

describe('patchItemsWithoutGroupAdd', () => {
    const memberA = makeMember({ id: 'a', type: SearchEntityType.menuItem });
    const memberB = makeMember({ id: 'b', type: SearchEntityType.station });

    it('adds members into matching type buckets, creating buckets as needed', () => {
        const items: AllItemsWithoutGroupByType = new Map();

        const next = patchItemsWithoutGroupAdd(items, [memberA, memberB]);

        assert.strictEqual(next.get(SearchEntityType.menuItem)?.get('a')?.id, 'a');
        assert.strictEqual(next.get(SearchEntityType.station)?.get('b')?.id, 'b');
    });

    it('returns the input unchanged when no members are added', () => {
        const items = toItemsWithoutGroupByType([memberA]);
        const next = patchItemsWithoutGroupAdd(items, []);
        assert.strictEqual(next, items);
    });
});
