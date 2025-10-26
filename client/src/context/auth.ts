import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { IClientUser } from '@msdining/common/models/auth';

export const UserContext = React.createContext(new ValueNotifier<IClientUser | undefined>(undefined));
