import { usePrismaClient } from '../client.js';
import { isSameDate, toDateString } from '@msdining/common/dist/util/date-util.js';
import { Lock } from 'semaphore-async-await';
import { IOrderingContext } from '../../../models/cart.js';
import { Nullable } from '../../../models/util.js';

const orderingContextLock = new Lock();

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
        try {
            await orderingContextLock.acquire();

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
                        context
                    });
                }
            }

            return this.#orderingContextByCafeIdForToday.get(cafeId)?.context;
        } finally {
            orderingContextLock.release();
        }
    }

    public static async createOrderingContextAsync(cafeId: string, context: IOrderingContext): Promise<void> {
        try {
            await orderingContextLock.acquire();

            const dateString = toDateString(new Date());

            await usePrismaClient(
                async prismaClient => {
                    await prismaClient.dailyCafeOrderingContext.upsert({
                        where: {
                            dateString_cafeId: {
                                dateString,
                                cafeId
                            }
                        },
                        update: context,
                        create: {
                            ...context,
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
        } finally {
            orderingContextLock.release();
        }
    }
}