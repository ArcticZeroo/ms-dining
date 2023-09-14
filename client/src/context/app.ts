import React from 'react';
import { IDiningHall } from '../models/dining-halls.ts';

interface IApplicationContext {
    diningHallsById: Map<string, IDiningHall>;
    diningHallIdsInOrder: string[];
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    diningHallsById: new Map(),
    diningHallIdsInOrder: []
});