import { IGroupData, IGroupMember, IUpdateGroupRequest } from '@msdining/common/models/group';
import { SearchEntityType } from '@msdining/common/models/search';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as GroupClient from '../../api/client/groups.ts';
import { AllItemsWithoutGroupByType } from '../../models/groups.ts';
import { getRandomId } from '../../util/id.ts';
import { queryKeys } from './keys.ts';

// ---------- Pure projection helpers (exported for testing) ----------

export const toGroupMap = (list: IGroupData[]): Map<string, IGroupData> =>
    new Map(list.map((group) => [group.id, group]));

export const toItemsWithoutGroupByType = (items: IGroupMember[]): AllItemsWithoutGroupByType => {
    const map: AllItemsWithoutGroupByType = new Map();
    for (const item of items) {
        let bucket = map.get(item.type);
        if (!bucket) {
            bucket = new Map();
            map.set(item.type, bucket);
        }
        bucket.set(item.id, item);
    }
    return map;
};

export const buildItemsWithoutGroupByNormalizedName = (
    items: AllItemsWithoutGroupByType
): Map<string /*normalizedName*/, IGroupMember[]> => {
    const result = new Map<string, IGroupMember[]>();
    for (const itemsById of items.values()) {
        for (const item of itemsById.values()) {
            const key = item.name.toLowerCase();
            let bucket = result.get(key);
            if (!bucket) {
                bucket = [];
                result.set(key, bucket);
            }
            bucket.push(item);
        }
    }
    return result;
};

// ---------- Pure cache patches (exported for testing) ----------

export const patchGroupUpdate = (
    groups: Map<string, IGroupData>,
    groupId: string,
    update: IUpdateGroupRequest,
): Map<string, IGroupData> => {
    const existing = groups.get(groupId);
    if (!existing) {
        return groups;
    }
    const next = new Map(groups);
    next.set(groupId, {
        ...existing,
        ...(update.name != null && { name: update.name }),
        ...(update.notes != null && { notes: update.notes }),
    });
    return next;
};

export const patchGroupRemoveMember = (
    groups: Map<string, IGroupData>,
    groupId: string,
    memberId: string,
): { groups: Map<string, IGroupData>; removedMembers: IGroupMember[] } => {
    const existing = groups.get(groupId);
    if (!existing) {
        return { groups, removedMembers: [] };
    }
    const removedMembers: IGroupMember[] = [];
    const remainingMembers: IGroupMember[] = [];
    for (const member of existing.members) {
        if (member.id === memberId) {
            removedMembers.push(member);
        } else {
            remainingMembers.push(member);
        }
    }
    if (removedMembers.length === 0) {
        return { groups, removedMembers };
    }
    const next = new Map(groups);
    next.set(groupId, { ...existing, members: remainingMembers });
    return { groups: next, removedMembers };
};

export const patchGroupDelete = (
    groups: Map<string, IGroupData>,
    groupId: string,
): { groups: Map<string, IGroupData>; removedMembers: IGroupMember[] } => {
    const existing = groups.get(groupId);
    if (!existing) {
        return { groups, removedMembers: [] };
    }
    const next = new Map(groups);
    next.delete(groupId);
    return { groups: next, removedMembers: existing.members };
};

export const patchGroupAddMembers = (
    groups: Map<string, IGroupData>,
    groupId: string,
    members: IGroupMember[],
): Map<string, IGroupData> => {
    const existing = groups.get(groupId);
    if (!existing) {
        return groups;
    }
    const addedIds = new Set(members.map((member) => member.id));
    const next = new Map(groups);
    next.set(groupId, {
        ...existing,
        members: [...existing.members.filter((member) => !addedIds.has(member.id)), ...members],
    });
    return next;
};

export const patchGroupCreate = (
    groups: Map<string, IGroupData>,
    group: IGroupData,
): Map<string, IGroupData> => {
    const next = new Map(groups);
    next.set(group.id, group);
    return next;
};

export const patchCandidatesRemoveAcceptedMembers = (
    candidates: Map<string, IGroupData>,
    acceptedMemberIds: ReadonlySet<string>,
): Map<string, IGroupData> => {
    let didAnythingChange = false;
    const next = new Map(candidates);
    for (const [candidateId, candidate] of candidates.entries()) {
        const remainingMembers = candidate.members.filter(
            (member) => !acceptedMemberIds.has(member.id),
        );
        if (remainingMembers.length === 0) {
            didAnythingChange = true;
            next.delete(candidateId);
        } else if (remainingMembers.length < candidate.members.length) {
            didAnythingChange = true;
            next.set(candidateId, { ...candidate, members: remainingMembers });
        }
    }
    return didAnythingChange ? next : candidates;
};

export const patchCandidatesAcceptInto = (
    candidates: Map<string, IGroupData>,
    candidate: IGroupData,
    acceptedMemberIds: ReadonlySet<string>,
): Map<string, IGroupData> => {
    const next = new Map(candidates);
    next.delete(candidate.id);

    const remainingMembers = candidate.members.filter(
        (member) => !acceptedMemberIds.has(member.id),
    );
    if (remainingMembers.length > 0) {
        const newId = getRandomId();
        next.set(newId, { ...candidate, id: newId, members: remainingMembers });
    }

    return next;
};

export const patchItemsWithoutGroupRemove = (
    items: AllItemsWithoutGroupByType,
    members: IGroupMember[],
): AllItemsWithoutGroupByType => {
    if (members.length === 0) {
        return items;
    }
    const next: AllItemsWithoutGroupByType = new Map();
    for (const [type, itemsById] of items.entries()) {
        next.set(type, new Map(itemsById));
    }
    for (const member of members) {
        next.get(member.type)?.delete(member.id);
    }
    return next;
};

export const patchItemsWithoutGroupAdd = (
    items: AllItemsWithoutGroupByType,
    members: IGroupMember[],
): AllItemsWithoutGroupByType => {
    if (members.length === 0) {
        return items;
    }
    const next: AllItemsWithoutGroupByType = new Map();
    for (const [type, itemsById] of items.entries()) {
        next.set(type, new Map(itemsById));
    }
    for (const member of members) {
        let bucket = next.get(member.type);
        if (!bucket) {
            bucket = new Map();
            next.set(member.type, bucket);
        }
        bucket.set(member.id, member);
    }
    return next;
};

// ---------- Queries ----------

export const useGroups = () =>
    useQuery({
        queryKey: queryKeys.groups.list,
        queryFn:  () => GroupClient.retrieveGroupList().then(toGroupMap),
    });

export const useZeroContextCandidates = () =>
    useQuery({
        queryKey: queryKeys.groups.zeroContext,
        queryFn:  () => GroupClient.retrieveGroupCandidatesZeroContext().then(toGroupMap),
    });

export const useItemsWithoutGroup = () =>
    useQuery({
        queryKey: queryKeys.groups.itemsWithoutGroup,
        queryFn:  () => GroupClient.retrieveItemsWithoutGroup().then(toItemsWithoutGroupByType),
    });

export const useItemsWithoutGroupByNormalizedName = () =>
    useQuery({
        queryKey: queryKeys.groups.itemsWithoutGroup,
        queryFn:  () => GroupClient.retrieveItemsWithoutGroup().then(toItemsWithoutGroupByType),
        select:   buildItemsWithoutGroupByNormalizedName,
    });

// ---------- Mutations ----------

/**
 * Cancel any in-flight fetch for `queryKey` before applying `updater` to the
 * cached value. Without the cancel, an older `queryFn` response could resolve
 * after a mutation's `onSuccess` patch and overwrite the post-mutation cache.
 *
 * Equivalent to the protection `LazyResource.updateExisting` used to provide.
 */
const patchQueryData = async <T>(
    queryClient: ReturnType<typeof useQueryClient>,
    queryKey: readonly unknown[],
    updater: (current: T) => T,
): Promise<void> => {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<T>(
        queryKey,
        (current) => (current ? updater(current) : current),
    );
};

const patchGroupsCache = (
    queryClient: ReturnType<typeof useQueryClient>,
    updater: (current: Map<string, IGroupData>) => Map<string, IGroupData>,
) => patchQueryData<Map<string, IGroupData>>(queryClient, queryKeys.groups.list, updater);

const patchCandidatesCache = (
    queryClient: ReturnType<typeof useQueryClient>,
    updater: (current: Map<string, IGroupData>) => Map<string, IGroupData>,
) => patchQueryData<Map<string, IGroupData>>(queryClient, queryKeys.groups.zeroContext, updater);

const patchItemsWithoutGroupCache = (
    queryClient: ReturnType<typeof useQueryClient>,
    updater: (current: AllItemsWithoutGroupByType) => AllItemsWithoutGroupByType,
) => patchQueryData<AllItemsWithoutGroupByType>(queryClient, queryKeys.groups.itemsWithoutGroup, updater);

interface IUpdateGroupArgs {
    groupId: string;
    request: IUpdateGroupRequest;
}

export const useUpdateGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, IUpdateGroupArgs>({
        mutationFn: ({ groupId, request }) => GroupClient.updateGroup(groupId, request),
        onSuccess:  async (_void, { groupId, request }) => {
            await patchGroupsCache(queryClient, (groups) => patchGroupUpdate(groups, groupId, request));
        },
    });
};

interface IDeleteGroupMemberArgs {
    groupId: string;
    memberId: string;
}

export const useDeleteGroupMember = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, IDeleteGroupMemberArgs>({
        mutationFn: ({ groupId, memberId }) => GroupClient.deleteGroupMember(groupId, memberId),
        onSuccess:  async (_void, { groupId, memberId }) => {
            let removedMembers: IGroupMember[] = [];
            await patchGroupsCache(queryClient, (groups) => {
                const patched = patchGroupRemoveMember(groups, groupId, memberId);
                removedMembers = patched.removedMembers;
                return patched.groups;
            });
            if (removedMembers.length > 0) {
                await patchItemsWithoutGroupCache(queryClient, (items) => patchItemsWithoutGroupAdd(items, removedMembers));
            }
        },
    });
};

export const useDeleteGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { groupId: string }>({
        mutationFn: ({ groupId }) => GroupClient.deleteGroup(groupId),
        onSuccess:  async (_void, { groupId }) => {
            let removedMembers: IGroupMember[] = [];
            await patchGroupsCache(queryClient, (groups) => {
                const patched = patchGroupDelete(groups, groupId);
                removedMembers = patched.removedMembers;
                return patched.groups;
            });
            if (removedMembers.length > 0) {
                await patchItemsWithoutGroupCache(queryClient, (items) => patchItemsWithoutGroupAdd(items, removedMembers));
            }
        },
    });
};

interface IAddGroupMembersArgs {
    groupId: string;
    members: IGroupMember[];
}

export const useAddGroupMembers = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, IAddGroupMembersArgs>({
        mutationFn: ({ groupId, members }) =>
            GroupClient.addGroupMembers(groupId, members.map((member) => member.id)),
        onSuccess: async (_void, { groupId, members }) => {
            await patchGroupsCache(queryClient, (groups) => patchGroupAddMembers(groups, groupId, members));
            const acceptedIds = new Set(members.map((member) => member.id));
            await patchCandidatesCache(queryClient, (candidates) => patchCandidatesRemoveAcceptedMembers(candidates, acceptedIds));
            await patchItemsWithoutGroupCache(queryClient, (items) => patchItemsWithoutGroupRemove(items, members));
        },
    });
};

interface ICreateGroupArgs {
    name: string;
    type: SearchEntityType;
    initialMembers: IGroupMember[];
}

export const useCreateGroup = () => {
    const queryClient = useQueryClient();
    return useMutation<{ id: string }, Error, ICreateGroupArgs>({
        mutationFn: ({ name, type, initialMembers }) =>
            GroupClient.createGroup({
                name,
                type,
                initialMembers: initialMembers.map((member) => member.id),
            }),
        onSuccess: async ({ id }, { name, type, initialMembers }) => {
            await patchGroupsCache(queryClient, (groups) =>
                patchGroupCreate(groups, { id, name, type, members: initialMembers }),
            );
            const acceptedIds = new Set(initialMembers.map((member) => member.id));
            await patchCandidatesCache(queryClient, (candidates) => patchCandidatesRemoveAcceptedMembers(candidates, acceptedIds));
            await patchItemsWithoutGroupCache(queryClient, (items) => patchItemsWithoutGroupRemove(items, initialMembers));
        },
    });
};

interface IAcceptCandidateMembersArgs {
    candidate: IGroupData;
    acceptedMemberIds: ReadonlySet<string>;
}

export const useAcceptCandidateMembers = () => {
    const queryClient = useQueryClient();
    return useMutation<{ id: string }, Error, IAcceptCandidateMembersArgs>({
        mutationFn: ({ candidate, acceptedMemberIds }) =>
            GroupClient.createGroup({
                name:           candidate.name,
                type:           candidate.type,
                initialMembers: Array.from(acceptedMemberIds),
            }),
        onSuccess: async ({ id }, { candidate, acceptedMemberIds }) => {
            const acceptedMembers = candidate.members.filter((member) => acceptedMemberIds.has(member.id));

            await patchCandidatesCache(queryClient, (candidates) =>
                patchCandidatesAcceptInto(candidates, candidate, acceptedMemberIds),
            );
            await patchGroupsCache(queryClient, (groups) =>
                patchGroupCreate(groups, { ...candidate, id, members: acceptedMembers }),
            );
            await patchItemsWithoutGroupCache(queryClient, (items) => patchItemsWithoutGroupRemove(items, acceptedMembers));
        },
    });
};

export const useRefreshGroups = () => {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups.list });
    };
};
