import React from 'react';
import { ContextWithUpdate } from '../models/context.ts';

export interface ISettingsContext {
    showImages: boolean;
    requestMenusInBackground: boolean;
    homepageDiningHallIds: Set<string>;
}

export const SettingsContext = React.createContext<ContextWithUpdate<ISettingsContext>>([
    {
        showImages: false,
        requestMenusInBackground: true,
        homepageDiningHallIds: new Set()
    },
    () => void 0
]);