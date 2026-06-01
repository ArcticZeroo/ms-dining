import { LockedExpiringMap } from '../../../shared/lock/map.js';
import { IOrderingContext } from '../../../shared/models/cart.js';
import Duration from '@arcticzeroo/duration';
import { BuyOnDemandClient } from '../../../shared/buy-ondemand/buy-ondemand-client.js';
import { requestDailyOrderingContextAsync } from '../cafe/buy-ondemand/ordering/ordering-context.js';

const ORDER_CONTEXT_CACHE = new LockedExpiringMap<string /*cafeId*/, IOrderingContext>(new Duration({ hours: 1 }));

export const retrieveDailyOrderingContext = (client: BuyOnDemandClient): Promise<IOrderingContext> => {
    return ORDER_CONTEXT_CACHE.getOrInsert(client.cafe.id, () => requestDailyOrderingContextAsync(client));
}