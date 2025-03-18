import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export interface IPopupContext {
    id: symbol,
    body: React.ReactNode,
}

export const PopupContext = React.createContext(new ValueNotifier<IPopupContext | null>(null));

export const closeActivePopup = (popupNotifier: ValueNotifier<IPopupContext | null>, onlyIfMatchesId?: symbol) => {
    if (popupNotifier.value && (!onlyIfMatchesId || popupNotifier.value.id === onlyIfMatchesId)) {
        popupNotifier.value = null;
    }
}