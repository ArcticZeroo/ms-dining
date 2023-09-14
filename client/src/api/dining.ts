import { IDiningHall, IDiningHallConcept } from '../models/dining-halls.ts';
import { pause } from '../util/async.ts';
import { ApplicationSettings } from './settings.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

export abstract class DiningHallClient {
    private static _diningHallsPromise: Promise<Array<IDiningHall>> | undefined = undefined;
    private static readonly _diningHallMenusById: Map<string, Promise<Array<IDiningHallConcept>>> = new Map();
    private static readonly _lastUsedDiningHallIds: string[] = ApplicationSettings.lastUsedDiningHalls.get();

    private static async _makeRequest<T>(path: string): Promise<T> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Response failed with status: ${response.status}`);
        }
        return await response.json();
    }

    private static async _retrieveDiningHallListInner(): Promise<Array<IDiningHall>> {
        return DiningHallClient._makeRequest('/api/dining/');
    }

    public static async retrieveDiningHallList(): Promise<Array<IDiningHall>> {
        if (!DiningHallClient._diningHallsPromise) {
            DiningHallClient._diningHallsPromise = DiningHallClient._retrieveDiningHallListInner();
        }

        return DiningHallClient._diningHallsPromise;
    }

    private static async _retrieveDiningHallMenuInner(id: string): Promise<Array<IDiningHallConcept>> {
        return DiningHallClient._makeRequest(`/api/dining/${id}`);
    }

    private static _addToLastUsedDiningHalls(id: string) {
        const existingIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(id);
        if (existingIndex !== -1) {
            DiningHallClient._lastUsedDiningHallIds.splice(existingIndex, 1);
        }
        DiningHallClient._lastUsedDiningHallIds.push(id);
        ApplicationSettings.lastUsedDiningHalls.set(DiningHallClient._lastUsedDiningHallIds);
    }

    public static async retrieveDiningHallMenu(id: string, shouldCountTowardsLastUsed: boolean = true): Promise<Array<IDiningHallConcept>> {
        try {
            if (!DiningHallClient._diningHallMenusById.has(id)) {
                DiningHallClient._diningHallMenusById.set(id, DiningHallClient._retrieveDiningHallMenuInner(id));
            }

            const menu = await DiningHallClient._diningHallMenusById.get(id)!;

            // Wait until retrieving successfully first so that we avoid holding a bunch of invalid dining halls
            if (shouldCountTowardsLastUsed) {
                DiningHallClient._addToLastUsedDiningHalls(id);
            }

            return menu;
        } catch (err) {
            DiningHallClient._diningHallMenusById.delete(id);
            throw err;
        }
    }

    public static getDiningHallRetrievalOrder(diningHalls: IDiningHall[]) {
        const homepageDiningHallIds = ApplicationSettings.homepageDiningHalls.get();
        return diningHalls.sort((a, b) => {
            const aIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(a.id);
            const bIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(b.id);
            const isAHomepage = homepageDiningHallIds.includes(a.id);
            const isBHomepage = homepageDiningHallIds.includes(b.id);

            if (isAHomepage && !isBHomepage) {
                return -1;
            }

            if (!isAHomepage && isBHomepage) {
                return 1;
            }

            if (aIndex === -1 && bIndex === -1) {
                return 0;
            }

            if (aIndex === -1) {
                return 1;
            }

            if (bIndex === -1) {
                return -1;
            }

            return bIndex - aIndex;
        });
    }

    public static async retrieveAllMenusInOrder(diningHalls: IDiningHall[]) {
        for (const diningHall of DiningHallClient.getDiningHallRetrievalOrder(diningHalls)) {
            await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);
            await DiningHallClient.retrieveDiningHallMenu(diningHall.id, false /*shouldCountTowardsLastUsed*/);
        }
    }
}