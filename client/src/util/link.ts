import { IDiningHall } from '../models/dining-halls.ts';

export const getDiningHallMenuUrl = (diningHall: IDiningHall) => {
    return `/menu/${diningHall.id}`;
}