import React from 'react';
import { CafeView } from '../models/cafe.ts';

export const MapPopupViewContext = React.createContext<CafeView | null>(null);