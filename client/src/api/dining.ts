import { CafeMenu, CafeView, ICafe, ICafeStation, IMenuItem, IViewListResponse } from '../models/cafe.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { expandAndFlattenView } from '../util/view';
import { ApplicationSettings, getVisitorId } from './settings.ts';
import { uncategorizedGroupId } from '../constants/groups.ts';
import { nativeDayValues } from '../util/date.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

export abstract class DiningClient {
    private static _viewListPromise: Promise<IViewListResponse> | undefined = undefined;
    private static readonly _cafeMenusById: Map<string, Promise<CafeMenu>> = new Map();
    private static _lastUsedCafeIds: string[] = [...ApplicationSettings.lastUsedCafeIds.value];

    private static _getRequestOptions(sendVisitorId: boolean) {
        if (!sendVisitorId) {
            return undefined;
        }

        return {
            headers: {
                'X-Visitor-Id': getVisitorId()
            }
        };
    }

    private static async _makeRequest<T>(path: string, sendVisitorId: boolean = false): Promise<T> {
        const response = await fetch(path, DiningClient._getRequestOptions(sendVisitorId));
        if (!response.ok) {
            throw new Error(`Response failed with status: ${response.status}`);
        }
        return await response.json();
    }

    private static async _retrieveViewListInner(): Promise<IViewListResponse> {
        const viewList: IViewListResponse = await DiningClient._makeRequest('/api/dining/', true /*sendVisitorId*/);
        viewList.groups.push({
            id:   uncategorizedGroupId,
            name: 'Individual Cafés',
        });
        return viewList;
    }

    public static async retrieveViewList(): Promise<IViewListResponse> {
        if (!DiningClient._viewListPromise) {
            DiningClient._viewListPromise = DiningClient._retrieveViewListInner();
        }

        return DiningClient._viewListPromise;
    }

    private static async _retrieveCafeMenuInner(id: string): Promise<Array<ICafeStation>> {
        return DiningClient._makeRequest(`/api/dining/${id}`);
    }

    private static _addToLastUsedCafeIds(id: string) {
        const newLastUsedCafeIds = DiningClient._lastUsedCafeIds.filter(existingId => existingId !== id);
        DiningClient._lastUsedCafeIds = newLastUsedCafeIds;
        ApplicationSettings.lastUsedCafeIds.value = newLastUsedCafeIds;
    }

    public static async retrieveCafeMenu(id: string, shouldCountTowardsLastUsed: boolean = true): Promise<CafeMenu> {
        try {
            if (!DiningClient._cafeMenusById.has(id)) {
                DiningClient._cafeMenusById.set(id, DiningClient._retrieveCafeMenuInner(id));
            }

            const menu = await DiningClient._cafeMenusById.get(id)!;

            // Wait until retrieving successfully first so that we avoid holding a bunch of invalid cafes
            if (shouldCountTowardsLastUsed) {
                DiningClient._addToLastUsedCafeIds(id);
            }

            return menu;
        } catch (err) {
            DiningClient._cafeMenusById.delete(id);
            throw err;
        }
    }

    public static getCafePriorityOrder(cafes: ICafe[], viewsById: Map<string, CafeView>) {
        const homepageViewIds = ApplicationSettings.homepageViews.value;
        const homepageCafeIds = new Set(
            Array.from(homepageViewIds)
                .filter(viewId => viewsById.has(viewId))
                .flatMap(viewId => expandAndFlattenView(viewId, viewsById))
                .map(cafe => cafe.id)
        );

        return cafes.sort((a, b) => {
            const aIndex = DiningClient._lastUsedCafeIds.indexOf(a.id);
            const bIndex = DiningClient._lastUsedCafeIds.indexOf(b.id);
            const isAHomepage = homepageCafeIds.has(a.id);
            const isBHomepage = homepageCafeIds.has(b.id);

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

    public static async retrieveAllMenusInOrder(cafes: ICafe[], viewsById: Map<string, CafeView>, cancellationToken?: ICancellationToken) {
        console.log('Retrieving cafe menus...');

        for (const cafe of DiningClient.getCafePriorityOrder(cafes, viewsById)) {
            await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);

            if (cancellationToken?.isCancelled || !ApplicationSettings.requestMenusInBackground.value) {
                break;
            }

            await DiningClient.retrieveCafeMenu(cafe.id, false /*shouldCountTowardsLastUsed*/);
        }
    }

    public static getThumbnailUrlForMenuItem(menuItem: IMenuItem) {
        return `/static/menu-items/thumbnail/${menuItem.id}.png`;
    }

    public static get isMenuProbablyOutdated(): boolean {
        const nowInLocalTime = new Date();
        const nowInPacificTime = new Date(nowInLocalTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

        // Menu isn't updated on weekends
        if ([nativeDayValues.Saturday, nativeDayValues.Sunday].includes(nowInPacificTime.getDay())) {
            return true;
        }

        // Menu is updated at 3am Pacific Time. Menus for things like boardwalk/craft75 might be valid until around 8pm.
        return nowInPacificTime.getHours() > 20
            || nowInPacificTime.getHours() < 3;
    }
}