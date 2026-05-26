import type { IGroupsService } from '../../../shared/services/groups.js';
import { dataHandler } from './handler.js';

export const groupsService: IGroupsService = {
    getGroups: (data) =>
        dataHandler.sendRequest('groups', 'getGroups', data),
    getGroupCandidatesZeroContext: (data) =>
        dataHandler.sendRequest('groups', 'getGroupCandidatesZeroContext', data),
    getCandidatesForGroup: (data) =>
        dataHandler.sendRequest('groups', 'getCandidatesForGroup', data),
    getGroupMembers: (data) =>
        dataHandler.sendRequest('groups', 'getGroupMembers', data),
    createGroup: (data) =>
        dataHandler.sendRequest('groups', 'createGroup', data),
    updateGroup: (data) =>
        dataHandler.sendRequest('groups', 'updateGroup', data),
    deleteGroup: (data) =>
        dataHandler.sendRequest('groups', 'deleteGroup', data),
    addToGroup: (data) =>
        dataHandler.sendRequest('groups', 'addToGroup', data),
    deleteMembersFromGroup: (data) =>
        dataHandler.sendRequest('groups', 'deleteMembersFromGroup', data),
};
