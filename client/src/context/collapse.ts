import React from 'react';
import { ValueNotifierSet } from '../util/events.ts';

export const CafeCollapseContext = React.createContext(new ValueNotifierSet<string /*cafeId*/>(new Set()));
export const StationCollapseContext = React.createContext(new ValueNotifierSet<string /*stationName*/>(new Set()));