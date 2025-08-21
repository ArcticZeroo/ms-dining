import React from 'react';
import { ValueNotifier } from '../util/events.ts';
import { IUser } from '@msdining/common/dist/models/http';

export const UserContext = React.createContext(new ValueNotifier<IUser | undefined>(undefined));
