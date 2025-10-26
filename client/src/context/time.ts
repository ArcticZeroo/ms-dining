import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { DiningClient } from '../api/client/dining.ts';

export const SelectedDateContext = React.createContext<ValueNotifier<Date>>(new ValueNotifier(DiningClient.getTodayDateForMenu()));