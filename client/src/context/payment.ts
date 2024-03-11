import React from 'react';
import { ValueNotifier } from '../util/events.ts';

// These are expected to never leave memory (i.e. not persisted)
export const CardNumberContext = React.createContext(new ValueNotifier<string>(''));
export const CardSecurityCodeContext = React.createContext(new ValueNotifier<string>(''));
