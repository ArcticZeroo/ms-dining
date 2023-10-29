import React from 'react';
import { CafeView } from '../models/cafe.ts';
import { ValueNotifier } from '../util/events.ts';

export const SelectedViewContext = React.createContext<ValueNotifier<CafeView | undefined>>(new ValueNotifier<CafeView | undefined>(undefined));