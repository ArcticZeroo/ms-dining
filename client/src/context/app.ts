import React from 'react';
import { DiningHallView, IDiningHall, IDiningHallGroupWithoutMembers } from '../models/dining-halls.ts';

interface IApplicationContext {
    viewsById: Map<string, DiningHallView>;
    viewsInOrder: DiningHallView[];
    diningHalls: IDiningHall[];
    groups: IDiningHallGroupWithoutMembers[];
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    viewsById:    new Map(),
    viewsInOrder: [],
    diningHalls:  [],
    groups:       []
});