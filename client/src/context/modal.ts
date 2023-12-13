import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export interface IModalContext {
    id: symbol,
    title: string,
    body: React.ReactNode,
}

export const ModalContext = React.createContext(new ValueNotifier<IModalContext | null>(null));