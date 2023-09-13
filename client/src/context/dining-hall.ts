import { IDiningHall } from '../models/dining-halls.ts';
import React from 'react';

export const SelectedDiningHallContext = React.createContext<[IDiningHall | undefined, (value: IDiningHall) => void]>([
    undefined,
    () => void 0
]);