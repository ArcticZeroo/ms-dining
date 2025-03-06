import Duration from '@arcticzeroo/duration';
import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { embedMenuItem, embedStation, isEmbeddedEntity } from '../api/storage/vector/client.js';
import { ICafeStation } from '../models/cafe.js';
import { Nullable } from '../models/util.js';
import { WorkerQueue } from './queue.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 1 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 5 });

interface IEmbeddingsMenuItemWork {
    entityType: SearchEntityType.menuItem;
    item: IMenuItem;
    stationName: string;
    categoryName: string;
}

interface IEmbeddingsStationWork {
    entityType: SearchEntityType.station;
    item: ICafeStation;
}

type EmbeddingsWorkItem = IEmbeddingsMenuItemWork | IEmbeddingsStationWork;

class EmbeddingsWorkerQueue extends WorkerQueue<string, EmbeddingsWorkItem> {
    constructor() {
        super({
            successPollInterval: QUEUE_SUCCESS_POLL_INTERVAL,
            emptyPollInterval:   QUEUE_EMPTY_POLL_INTERVAL,
            failedPollInterval:  QUEUE_FAILED_POLL_INTERVAL,
        });

        this.start();
    }

    protected getKey(entry: EmbeddingsWorkItem): string {
        return entry.item.id;
    }

    async doWorkAsync(entry: EmbeddingsWorkItem): Promise<void | Nullable<symbol>> {
        const isEmbedded = await isEmbeddedEntity(entry.entityType, entry.item.id);

        if (isEmbedded) {
            return WorkerQueue.QUEUE_SKIP_ENTRY;
        }

        if (entry.entityType === SearchEntityType.menuItem) {
            await embedMenuItem(entry.item, entry.categoryName, entry.stationName);
        } else {
            await embedStation(entry.item);
        }
    }

    public addFromMenu(stations: ICafeStation[]) {
        for (const station of stations) {
            this.add({
                entityType: SearchEntityType.station,
                item:       station,
            });

            for (const [category, menuItemIds] of station.menuItemIdsByCategoryName) {
                for (const menuItemId of menuItemIds) {
                    const menuItem = station.menuItemsById.get(menuItemId);
                    if (menuItem) {
                        this.add({
                            entityType:   SearchEntityType.menuItem,
                            item:         menuItem,
                            stationName:  station.name,
                            categoryName: category,
                        });
                    }
                }
            }
        }
    }
}

export const EMBEDDINGS_WORKER_QUEUE = new EmbeddingsWorkerQueue();