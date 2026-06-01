import { usePrismaClient, usePrismaWrite } from '../../client.js';
import { isSameDate, toDateString } from '@msdining/common/util/date-util';
import { Lock } from '@frozor/lock';
import { IOrderingContext } from '../../../../../shared/models/cart.js';
import { Nullable } from '../../../../../shared/models/util.js';

const orderingContextLock = new Lock();

type IPersistedOrderingContext = Pick<IOrderingContext,
    'onDemandTerminalId' |
    'onDemandEmployeeId' |
    'profitCenterId' |
    'storePriceLevel' |
    'profitCenterName' |
    'payClientId'>;

const toPersistedOrderingContext = (context: IOrderingContext): IPersistedOrderingContext => ({
    onDemandTerminalId: context.onDemandTerminalId,
    onDemandEmployeeId: context.onDemandEmployeeId,
    profitCenterId: context.profitCenterId,
    storePriceLevel: context.storePriceLevel,
    profitCenterName: context.profitCenterName,
    payClientId: context.payClientId,
});

const hydrateOrderingContext = (context: IPersistedOrderingContext): IOrderingContext => ({
    ...context,
    fullSiteStoreInfo: {},
    fullPickupConfig: {},
});

interface IOrderingContextEntry {
    context: IOrderingContext;
    lastRetrievedDate: Date;
}

export abstract class OrderingClient {
    static #orderingContextByCafeIdForToday: Map<string, IOrderingContextEntry> = new Map();

    private static _ensureCacheIsRecent(cafeId: string) {
        if (!this.#orderingContextByCafeIdForToday.has(cafeId)) {
            return;
        }

        const entry = this.#orderingContextByCafeIdForToday.get(cafeId)!;

        // We don't ever deal with future/past menus for online ordering, only today.
        if (!isSameDate(entry.lastRetrievedDate, new Date())) {
            this.#orderingContextByCafeIdForToday.delete(cafeId);
        }
    }

    public static async retrieveOrderingContextAsync(cafeId: string): Promise<Nullable<IOrderingContext>> {
        return orderingContextLock.acquire(async () => {
            this._ensureCacheIsRecent(cafeId);

            if (!this.#orderingContextByCafeIdForToday.has(cafeId)) {
                const dateString = toDateString(new Date());

                const context = await usePrismaClient(
                    prismaClient => prismaClient.dailyCafeOrderingContext.findFirst({
                        where: {
                            dateString,
                            cafeId
                        }
                    })
                );

                if (context != null) {
                    this.#orderingContextByCafeIdForToday.set(cafeId, {
                        lastRetrievedDate: new Date(),
                        context: hydrateOrderingContext(context)
                    });
                }
            }

            return this.#orderingContextByCafeIdForToday.get(cafeId)?.context;
        });
    }

    public static async createOrderingContextAsync(cafeId: string, context: IOrderingContext): Promise<void> {
        return orderingContextLock.acquire(async () => {
            const dateString = toDateString(new Date());

            const persistedContext = toPersistedOrderingContext(context);

            await usePrismaWrite(
                async prismaClient => {
                    await prismaClient.dailyCafeOrderingContext.upsert({
                        where: {
                            dateString_cafeId: {
                                dateString,
                                cafeId
                            }
                        },
                        update: persistedContext,
                        create: {
                            ...persistedContext,
                            dateString,
                            cafeId
                        }
                    })
                }
            );

            this.#orderingContextByCafeIdForToday.set(cafeId, {
                lastRetrievedDate: new Date(),
                context,
            });
        });
    }
}