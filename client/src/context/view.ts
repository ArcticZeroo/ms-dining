import React from 'react';
import { CafeView } from '../models/cafe.ts';

export const SelectedViewContext = React.createContext<[CafeView | undefined, (value: CafeView) => void]>([
    undefined,
    () => void 0
]);