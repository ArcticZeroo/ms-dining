import { IDiningHall, IDiningHallConcept } from '../models/dining-halls.ts';
import { getStringArraySetting, setStringArraySetting } from './settings.ts';
import { settingNames } from '../constants/settings.ts';
import { pause } from '../util/async.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

export abstract class DiningHallClient {
    private static readonly _diningHallMenusById: Map<string, Promise<Array<IDiningHallConcept>>> = new Map();
    private static readonly _lastUsedDiningHallIds: string[] = getStringArraySetting(settingNames.lastUsedDiningHalls);

    public static async retrieveDiningHallList(): Promise<Array<IDiningHall>> {
        const response = await fetch('/api/dining/');
        return await response.json();
    }

    private static async _retrieveDiningHallMenuInner(id: string): Promise<Array<IDiningHallConcept>> {
        const response = await fetch(`/api/dining/${id}`);
        return await response.json();
    }

    private static _addToLastUsedDiningHalls(id: string) {
        const existingIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(id);
        if (existingIndex !== -1) {
            DiningHallClient._lastUsedDiningHallIds.splice(existingIndex, 1);
        }
        DiningHallClient._lastUsedDiningHallIds.push(id);
        setStringArraySetting(settingNames.lastUsedDiningHalls, DiningHallClient._lastUsedDiningHallIds);
    }

    public static async retrieveDiningHallMenu(id: string): Promise<Array<IDiningHallConcept>> {
        try {
            if (!DiningHallClient._diningHallMenusById.has(id)) {
                DiningHallClient._diningHallMenusById.set(id, DiningHallClient._retrieveDiningHallMenuInner(id));
            }

            const menu = await DiningHallClient._diningHallMenusById.get(id)!;
            DiningHallClient._addToLastUsedDiningHalls(id);
            return menu;
        } catch (err) {
            DiningHallClient._diningHallMenusById.delete(id);
            throw err;
        }
    }

    public static getDiningHallRetrievalOrder(diningHalls: IDiningHall[]) {
        return diningHalls.sort((a, b) => {
            const aIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(a.id);
            const bIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(b.id);

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
            await DiningHallClient.retrieveDiningHallMenu(diningHall.id);
        }
    }
}