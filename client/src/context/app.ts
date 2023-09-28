import React from 'react';
import { CafeView, ICafe, ICafeGroupWithoutMembers } from '../models/cafe.ts';

interface IApplicationContext {
    viewsById: Map<string, CafeView>;
    viewsInOrder: CafeView[];
    cafes: ICafe[];
    groups: ICafeGroupWithoutMembers[];
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    viewsById:    new Map(),
    viewsInOrder: [],
    cafes:        [],
    groups:       []
});