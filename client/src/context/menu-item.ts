import React from 'react';
import { ICafe } from '../models/cafe.ts';


export const CurrentCafeContext = React.createContext<ICafe>({
    id:      '',
    name:    '',
    logoUrl: ''
});