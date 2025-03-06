import Duration from '@arcticzeroo/duration';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { retrieveMenuItemSearchTagsFromAiWithRetries } from '../api/openai.js';
import { MenuItemStorageClient } from '../api/storage/clients/menu-item.js';
import { Nullable } from '../models/util.js';
import { logDebug, logError } from '../util/log.js';
import { WorkerQueue } from './queue.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 5 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 15 });

// TODO: use category/station name to give a better hint to the AI
export interface ISearchTagQueueEntry {
    id: string;
    name: string;
    description: Nullable<string>;
}

class SearchTagsWorkerQueue extends WorkerQueue<string, ISearchTagQueueEntry> {
    constructor() {
        super({
            successPollInterval: QUEUE_SUCCESS_POLL_INTERVAL,
            emptyPollInterval:   QUEUE_EMPTY_POLL_INTERVAL,
            failedPollInterval:  QUEUE_FAILED_POLL_INTERVAL
        });
    }

    add(...entries: ISearchTagQueueEntry[]) {
        super.add(...entries);
    }

    protected getKey(entry: ISearchTagQueueEntry): string {
        return normalizeNameForSearch(entry.name);
    }

    public async doWorkAsync({ id, name, description }: ISearchTagQueueEntry) {
        let workResult: symbol | undefined = undefined;
        let searchTags = await MenuItemStorageClient.getExistingSearchTagsForName(name);

        if (searchTags.size === 0) {
            searchTags = await retrieveMenuItemSearchTagsFromAiWithRetries({ name, description });
        } else {
            logDebug('Search tags already exist for:', name);
            workResult = WorkerQueue.QUEUE_SKIP_ENTRY;
        }

        if (searchTags.size === 0) {
            logDebug('No search tags found for:', name);
            return;
        }

        await MenuItemStorageClient.saveMenuItemSearchTagsAsync(id, searchTags);
        return workResult;
    }
}

export const SEARCH_TAG_WORKER_QUEUE = new SearchTagsWorkerQueue();

const startQueue = () => {
    SEARCH_TAG_WORKER_QUEUE.start();
    MenuItemStorageClient.retrievePendingSearchTagQueueEntries()
        .then(entries => SEARCH_TAG_WORKER_QUEUE.add(...entries))
        .catch(err => logError('Unable to retrieve pending search tag queue entries:', err));
}

startQueue();