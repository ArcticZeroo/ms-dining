import { IDiningHall } from '../models/dining-hall.js';

export const getBaseApiUrlWithoutTrailingSlash = ({ url }: IDiningHall) => `https://${url}.buy-ondemand.com/api`;

export const diningHalls: IDiningHall[] = [
    {
        internalName: 'cafe34',
        friendlyName: 'Cafe 34',
        url:          'cafe34'
    }
]