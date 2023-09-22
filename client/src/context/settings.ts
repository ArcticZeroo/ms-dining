import React from 'react';
import { ContextWithUpdate } from '../models/context.ts';

export interface ISettingsContext {
    useGroups: boolean;
    showImages: boolean;
    showCalories: boolean;
    requestMenusInBackground: boolean;
    homepageViewIds: Set<string>;
}

export const SettingsContext = React.createContext<ContextWithUpdate<ISettingsContext>>([
    {
        useGroups: true,
        showImages: false,
        showCalories: true,
        requestMenusInBackground: true,
        homepageViewIds: new Set()
    },
    () => void 0
]);