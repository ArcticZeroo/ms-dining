import { ISearchExplanation } from '@msdining/common/models/search';
import { makeJsonRequest } from '../request.js';

interface IExplainSearchParams {
    query: string;
    /** Item name (resolved to all matching ids) — provide this or menuItemId. */
    name?: string;
    /** Exact menu item id — provide this or name. */
    menuItemId?: string;
    /** Optional date (YYYY-MM-DD) to scope the menu window to a single day. */
    date?: string;
}

export const explainSearch = async ({ query, name, menuItemId, date }: IExplainSearchParams): Promise<ISearchExplanation> => {
    const params = new URLSearchParams({ q: query });
    if (name) {
        params.set('name', name);
    }
    if (menuItemId) {
        params.set('id', menuItemId);
    }
    if (date) {
        params.set('date', date);
    }

    return makeJsonRequest<ISearchExplanation>({
        path: `/api/dining/search/explain?${params.toString()}`,
    });
};
