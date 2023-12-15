import React from 'react';
import { CafeView, ICafe, ICafeGroupWithoutMembers } from '../models/cafe.ts';

interface IApplicationContext {
    viewsById: Map<string, CafeView>;
    viewsInOrder: CafeView[];
    cafes: ICafe[];
    groups: ICafeGroupWithoutMembers[];
    // Cafes won't be in this list if they don't have a number
    cafeNumbersById: Map<string, number>;
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    viewsById:       new Map(),
    viewsInOrder:    [],
    cafes:           [],
    groups:          [],
    cafeNumbersById: new Map(),
});