import React from 'react';
import { ValueNotifier } from '../util/events.ts';

export const UserIdContext = React.createContext(new ValueNotifier<string | undefined>(undefined));
