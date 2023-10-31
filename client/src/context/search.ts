import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export const SearchQueryContext = React.createContext<ValueNotifier<string>>(new ValueNotifier<string>(''));