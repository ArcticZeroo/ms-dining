import { usePrismaClient } from '../client.js';
import { isSameDate, toDateString } from '@msdining/common/dist/util/date-util.js';
import Semaphore from 'semaphore-async-await';
import { IOrderingContext } from '../../../models/cart.js';

const orderingContextLock = new Semaphore.Lock();

export abstract class OrderingClient {
    static #lastRetrievedDate: Date = new Date(0);
    static #orderingContextByCafeIdForToday: Map<string, IOrderingContext> = new Map();

    private static _ensureCacheIsRecent() {
        // We don't ever deal with future/past menus for online ordering, only today.
        if (!isSameDate(this.#lastRetrievedDate, new Date())) {
            this.#orderingContextByCafeIdForToday.clear();
        }
    }

    public static async retrieveOrderingContextAsync(cafeId: string): Promise<IOrderingContext | null> {
        try {
            await orderingContextLock.acquire();

            this._ensureCacheIsRecent();

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
                    this.#orderingContextByCafeIdForToday.set(cafeId, context);
                }
            }

            return this.#orderingContextByCafeIdForToday.get(cafeId);
        } finally {
            orderingContextLock.release();
        }
    }

    public static async createOrderingContextAsync(cafeId: string, orderingContext: IOrderingContext): Promise<void> {
        try {
            await orderingContextLock.acquire();

            this._ensureCacheIsRecent();

            const dateString = toDateString(new Date());

            await usePrismaClient(
                prismaClient => prismaClient.dailyCafeOrderingContext.create({
                    data: {
                        ...orderingContext,
                        dateString, cafeId
                    }
                })
            );

            this.#orderingContextByCafeIdForToday.set(cafeId, orderingContext);
        } finally {
            orderingContextLock.release();
        }
    }
}