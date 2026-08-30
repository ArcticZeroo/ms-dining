import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export interface IPopupContext {
    id: symbol,
    body: React.ReactNode,
    // When true, this popup owns a single history entry: closing it (via any
    // vector) pops that entry with navigate(-1) instead of pushing a new one, and
    // the stored popup is dropped once dismissed. This keeps the browser back and
    // forward buttons from resurrecting a popup whose live state is gone (e.g. a
    // payment mid-flow), and avoids leaving a duplicate history entry behind.
    popHistoryOnClose?: boolean,
}

export const PopupContext = React.createContext(new ValueNotifier<IPopupContext | null>(null));