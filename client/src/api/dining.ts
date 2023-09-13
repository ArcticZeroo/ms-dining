import { IDiningHall, IDiningHallConcept } from '../models/dining-halls.ts';

export abstract class DiningHallClient {
    private static _diningHallMenusById: Map<string, Array<IDiningHallConcept>> = new Map();

    public static async retrieveDiningHallList(): Promise<Array<IDiningHall>> {
        const response = await fetch('/api/dining/');
        return await response.json();
    }

    public static async retrieveDiningHallMenu(id: string): Promise<Array<IDiningHallConcept>> {
        if (!DiningHallClient._diningHallMenusById.has(id)) {
            const response = await fetch(`/api/dining/${id}`);
            const concepts = await response.json();
            DiningHallClient._diningHallMenusById.set(id, concepts);
        }
        return DiningHallClient._diningHallMenusById.get(id)!;
    }
}