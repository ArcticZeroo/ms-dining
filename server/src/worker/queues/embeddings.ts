import Duration from '@arcticzeroo/duration';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import {
    embedMenuItem,
    isEmbeddedEntity,
} from '../data/storage/vector/client.js';
import { ICafeStation } from '../../shared/models/cafe.js';
import { Nullable } from '../../shared/models/util.js';
import { WorkerQueue } from './queue.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 1 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 5 });

interface IEmbeddingsWorkItem {
    entityType: SearchEntityType.menuItem;
    item: IMenuItemBase;
    stationName: string;
    categoryName: string;
}

class EmbeddingsWorkerQueue extends WorkerQueue<string, IEmbeddingsWorkItem> {
    constructor() {
        super({
            successPollInterval: QUEUE_SUCCESS_POLL_INTERVAL,
            emptyPollInterval:   QUEUE_EMPTY_POLL_INTERVAL,
            failedPollInterval:  QUEUE_FAILED_POLL_INTERVAL,
        });

        this.start();
    }

    protected getKey(entry: IEmbeddingsWorkItem): string {
        return entry.item.id;
    }

    async doWorkAsync(entry: IEmbeddingsWorkItem): Promise<void | Nullable<symbol>> {
        const id = this.getKey(entry);
        const isEmbedded = await isEmbeddedEntity(entry.entityType, id);

        if (isEmbedded) {
            return WorkerQueue.QUEUE_SKIP_ENTRY;
        }

        await embedMenuItem(entry.item, entry.categoryName, entry.stationName);
    }

    public addFromMenu(stations: ICafeStation[]) {
        for (const station of stations) {
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