import React from 'react';
import { IDiningHall } from '../models/dining-halls.ts';

interface IApplicationContext {
    diningHalls: IDiningHall[];
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    diningHalls: []
});