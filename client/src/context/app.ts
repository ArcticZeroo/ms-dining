import React from 'react';
import { DiningHallView, IDiningHall, IDiningHallGroup } from '../models/dining-halls.ts';

interface IApplicationContext {
	viewsById: Map<string, DiningHallView>;
	viewsInOrder: DiningHallView[];
	diningHalls: IDiningHall[];
	groups: IDiningHallGroup[];
}

export const ApplicationContext = React.createContext<IApplicationContext>({
	viewsById:    new Map(),
	viewsInOrder: []
});