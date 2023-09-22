import React from 'react';
import { DiningHallView } from '../models/dining-halls.ts';

export const SelectedViewContext = React.createContext<[DiningHallView | undefined, (value: DiningHallView) => void]>([
    undefined,
    () => void 0
]);