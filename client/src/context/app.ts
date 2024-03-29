import React from 'react';
import { CafeView, ICafe, ICafeGroup } from '../models/cafe.ts';

interface IApplicationContext {
	viewsById: Map<string, CafeView>;
	viewsInOrder: CafeView[];
	cafes: ICafe[];
	groups: ICafeGroup[];
	isTrackingEnabled: boolean;
}

export const ApplicationContext = React.createContext<IApplicationContext>({
    viewsById:         new Map(),
    viewsInOrder:      [],
    cafes:             [],
    groups:            [],
    isTrackingEnabled: false,
});