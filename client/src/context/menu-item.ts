import React from 'react';
import { ICafe } from '../models/cafe.ts';

export const CurrentCafeContext = React.createContext<ICafe>({
    id:      '',
    name:    '',
    logoUrl: ''
});

export const CurrentStationScrollIdContext = React.createContext<string>('');

export interface IStationInfo {
    id: string;
    name: string;
}

export const StationInfoContext = React.createContext<IStationInfo>({ id: '', name: '' });