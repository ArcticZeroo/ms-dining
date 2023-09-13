import { IDiningHall } from '../models/dining-halls.ts';

export abstract class DiningHallClient {
    public static async retrieveDiningHallList(): Promise<IDiningHall[]> {
        const response = await fetch('/api/dining/');
        return await response.json();
    }
}