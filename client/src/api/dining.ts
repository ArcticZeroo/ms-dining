import { DiningHallView, IDiningHall, IDiningHallStation, IViewListResponse } from '../models/dining-halls.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { expandAndFlattenView } from '../util/view';
import { ApplicationSettings, getVisitorId } from './settings.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

export abstract class DiningHallClient {
	private static _viewListPromise: Promise<IViewListResponse> | undefined = undefined;
	private static readonly _diningHallMenusById: Map<string, Promise<Array<IDiningHallStation>>> = new Map();
	private static readonly _lastUsedDiningHallIds: string[] = ApplicationSettings.lastUsedDiningHalls.get();

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
		const response = await fetch(path, DiningHallClient._getRequestOptions(sendVisitorId));
		if (!response.ok) {
			throw new Error(`Response failed with status: ${response.status}`);
		}
		return await response.json();
	}

	private static async _retrieveViewListInner(): Promise<IViewListResponse> {
		return DiningHallClient._makeRequest('/api/dining/', true /*sendVisitorId*/);
	}

	public static async retrieveViewList(): Promise<IViewListResponse> {
		if (!DiningHallClient._viewListPromise) {
			DiningHallClient._viewListPromise = DiningHallClient._retrieveViewListInner();
		}

		return DiningHallClient._viewListPromise;
	}

	private static async _retrieveDiningHallMenuInner(id: string): Promise<Array<IDiningHallStation>> {
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

	public static async retrieveDiningHallMenu(id: string, shouldCountTowardsLastUsed: boolean = true): Promise<Array<IDiningHallStation>> {
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

	public static getDiningHallRetrievalOrder(diningHalls: IDiningHall[], viewsById: Map<string, DiningHallView>) {
		const homepageViewIds = ApplicationSettings.homepageViews.get();
		const homepageDiningHallIds = new Set(
			homepageViewIds
				.flatMap(viewId => expandAndFlattenView(viewId, viewsById))
				.map(diningHall => diningHall.id)
		);

		return diningHalls.sort((a, b) => {
			const aIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(a.id);
			const bIndex = DiningHallClient._lastUsedDiningHallIds.indexOf(b.id);
			const isAHomepage = homepageDiningHallIds.has(a.id);
			const isBHomepage = homepageDiningHallIds.has(b.id);

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

	public static async retrieveAllMenusInOrder(diningHalls: IDiningHall[], viewsById: Map<string, DiningHallView>, cancellationToken?: ICancellationToken) {
		console.log('Retrieving dining hall menus...');

		for (const diningHall of DiningHallClient.getDiningHallRetrievalOrder(diningHalls, viewsById)) {
			await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);

			if (cancellationToken?.isCancelled || !ApplicationSettings.requestMenusInBackground.get()) {
				break;
			}

			await DiningHallClient.retrieveDiningHallMenu(diningHall.id, false /*shouldCountTowardsLastUsed*/);
		}
	}
}