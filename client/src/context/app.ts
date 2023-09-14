import React from 'react';
import { IDiningHall } from '../models/dining-halls.ts';

interface IApplicationContext {
    diningHallsById: Map<string, IDiningHall>;
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    diningHallsById: new Map()
});