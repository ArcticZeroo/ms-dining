import React from 'react';
import { TypedEventEmitter } from '../util/events.js';
import { IGroupData } from '@msdining/common/models/group';

export type GroupEvents = {
    updateGroupList: () => void;
    groupCreated: (group: IGroupData) => void;
    groupDeleted: (groupId: string) => void;
}

export const GroupEventsContext = React.createContext<TypedEventEmitter<GroupEvents>>(new TypedEventEmitter());