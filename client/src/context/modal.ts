import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export interface IPopupContext {
    id: symbol,
    body: React.ReactNode,
}

export const PopupContext = React.createContext(new ValueNotifier<IPopupContext | null>(null));