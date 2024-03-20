import { retrieveMenuItemSearchTagsFromAiWithRetries } from '../openai.js';
import { MenuItemStorageClient } from '../storage/clients/menu-item.js';
import { Nullable } from '../../models/util.js';
import { logDebug, logError } from '../../util/log.js';
import { WorkerQueue } from './queue.js';
import Duration from '@arcticzeroo/duration';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 5 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 15 });

export interface ISearchTagQueueEntry {
    id: string;
    name: string;
    description: Nullable<string>;
}

class SearchTagsWorkerQueue extends WorkerQueue<ISearchTagQueueEntry> {
    constructor() {
        super({
            successPollInterval: QUEUE_SUCCESS_POLL_INTERVAL,
            emptyPollInterval:   QUEUE_EMPTY_POLL_INTERVAL,
            failedPollInterval:  QUEUE_FAILED_POLL_INTERVAL
        });
    }

    public async doWorkAsync({ id, name, description }: ISearchTagQueueEntry) {
        let searchTags = await MenuItemStorageClient.getExistingSearchTagsForName(name);

        if (searchTags.size === 0) {
            searchTags = await retrieveMenuItemSearchTagsFromAiWithRetries(name, description);
        } else {
            logDebug('Search tags already exist for:', name);
            return WorkerQueue.QUEUE_SKIP_ENTRY;
        }

        if (searchTags.size === 0) {
            logDebug('No search tags found for:', name);
            return;
        }

        await MenuItemStorageClient.saveMenuItemSearchTagsAsync(id, searchTags);
    }
}

export const SEARCH_TAG_WORKER_QUEUE = new SearchTagsWorkerQueue();

const startQueue = () => {
    // queue is currently started in boot in order to normalize names first
    // SEARCH_TAG_WORKER_QUEUE.start();
    MenuItemStorageClient.retrievePendingSearchTagQueueEntries()
        .then(entries => SEARCH_TAG_WORKER_QUEUE.add(...entries))
        .catch(err => logError('Unable to retrieve pending search tag queue entries:', err));
}

startQueue();


