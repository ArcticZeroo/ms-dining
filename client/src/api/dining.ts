import { CafeMenu, CafeView, ICafe, ICafeStation, IMenuItem, IViewListResponse } from '../models/cafe.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { expandAndFlattenView } from '../util/view';
import { ApplicationSettings, getVisitorId } from './settings.ts';
import { uncategorizedGroupId } from '../constants/groups.ts';
import { nativeDayOfWeek, nativeDayValues, toDateString } from '../util/date.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

interface IRetrieveCafeMenuParams {
    id: string;
    date?: Date;
    shouldCountTowardsLastUsed?: boolean;
}

export abstract class DiningClient {
    private static _viewListPromise: Promise<IViewListResponse> | undefined = undefined;
    private static readonly _cafeMenusByIdPerDateString: Map<string, Map<string, Promise<CafeMenu>>> = new Map();

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

    private static async _retrieveCafeMenuInner(id: string, dateString: string): Promise<Array<ICafeStation>> {
        return DiningClient._makeRequest(`/api/dining/${id}?date=${dateString}`);
    }

    private static _addToLastUsedCafeIds(id: string) {
        ApplicationSettings.lastUsedCafeIds.value = ApplicationSettings.lastUsedCafeIds.value.filter(existingId => existingId !== id);
    }

    public static getMinimumDateForMenu(): Date {
        const now = new Date();
        const currentDayOfWeek = now.getDay();

        let daysSinceMonday = currentDayOfWeek - nativeDayOfWeek.Monday;
        if (daysSinceMonday <= 0) {
            daysSinceMonday += 7;
        }

        now.setDate(now.getDate() - daysSinceMonday);

        return now;
    }

    public static getMaximumDateForMenu(): Date {
        const now = new Date();
        const currentDayOfWeek = now.getDay();

        let daysUntilFriday = nativeDayOfWeek.Friday - currentDayOfWeek;
        if (daysUntilFriday <= 0) {
            daysUntilFriday += 7;
        }

        now.setDate(now.getDate() + daysUntilFriday);

        return now;
    }

    public static ensureDateIsNotWeekendForMenu(date: Date): Date {
        const dayOfWeek = date.getDay();

        if ([nativeDayValues.Saturday, nativeDayValues.Sunday].includes(dayOfWeek)) {
            let daysUntilMonday = nativeDayValues.Monday - dayOfWeek;
            if (daysUntilMonday <= 0) {
                daysUntilMonday += 7;
            }

            date.setDate(date.getDate() + daysUntilMonday);
        }
        return date;
    }

    public static getTodayDateForMenu() {
        return DiningClient.ensureDateIsNotWeekendForMenu(new Date());
    }

    public static async retrieveCafeMenu({
                                             id,
                                             shouldCountTowardsLastUsed,
                                             date,
                                         }: IRetrieveCafeMenuParams): Promise<CafeMenu> {
        const dateString = toDateString(date ?? DiningClient.getTodayDateForMenu());

        try {
            if (!DiningClient._cafeMenusByIdPerDateString.has(id)) {
                DiningClient._cafeMenusByIdPerDateString.set(dateString, new Map());
            }

            const cafeMenusById = DiningClient._cafeMenusByIdPerDateString.get(dateString)!;
            if (!cafeMenusById.has(id)) {
                cafeMenusById.set(id, DiningClient._retrieveCafeMenuInner(id, dateString));
            }

            const menu = await cafeMenusById.get(id)!;

            // Wait until retrieving successfully first so that we avoid holding a bunch of invalid cafes
            if (shouldCountTowardsLastUsed) {
                DiningClient._addToLastUsedCafeIds(id);
            }

            return menu;
        } catch (err) {
            DiningClient._cafeMenusByIdPerDateString.delete(id);
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

        const lastUsedCafeIds = ApplicationSettings.lastUsedCafeIds.value;

        return cafes.sort((a, b) => {
            const aIndex = lastUsedCafeIds.indexOf(a.id);
            const bIndex = lastUsedCafeIds.indexOf(b.id);
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

            await DiningClient.retrieveCafeMenu({
                id:                         cafe.id,
                shouldCountTowardsLastUsed: false
            });
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