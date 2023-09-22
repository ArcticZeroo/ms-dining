import { DiningHallView } from '../models/dining-halls.ts';

export const getViewUrl = (view: DiningHallView) => `/menu/${view.value.id}`;