import React from 'react';
import { CafesOnPageNotifier } from '../util/cafes-on-page.ts';

export const CafesOnPageContext = React.createContext<CafesOnPageNotifier>(new CafesOnPageNotifier());