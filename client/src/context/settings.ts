import React from 'react';
import { ContextWithUpdate } from '../models/context.ts';

export interface ISettingsContext {
    showImages: boolean;
}

export const SettingsContext = React.createContext<ContextWithUpdate<ISettingsContext>>([
    {
        showImages: false
    },
    () => void 0
]);