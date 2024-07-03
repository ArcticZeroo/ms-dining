import { IS_OPENAI_ENABLED, retrieveMenuItemSearchTagsFromAiWithRetries } from '../openai.js';
import { MenuItemStorageClient } from '../storage/clients/menu-item.js';
import { Nullable } from '../../models/util.js';
import { logDebug, logError, logInfo } from '../../util/log.js';
import { WorkerQueue } from './queue.js';
import Duration from '@arcticzeroo/duration';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 5 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 15 });

// TODO: use category/station name to give a better hint to the AI
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

    get isEnabled() {
        return IS_OPENAI_ENABLED;
    }

    add(...entries: ISearchTagQueueEntry[]) {
        if (!this.isEnabled) {
            return;
        }

        super.add(...entries);
    }

    public async doWorkAsync({ id, name, description }: ISearchTagQueueEntry) {
        let workResult: symbol | undefined = undefined;
        let searchTags = await MenuItemStorageClient.getExistingSearchTagsForName(name);

        if (searchTags.size === 0) {
            searchTags = await retrieveMenuItemSearchTagsFromAiWithRetries(name, description);
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
    // Don't bother starting the queue if OpenAI is disabled
    if (!SEARCH_TAG_WORKER_QUEUE.isEnabled) {
        logInfo('OpenAI is disabled due to missing env variable, search tag worker queue will not start');
        return;
    }

    // queue is currently started in boot in order to normalize names first
    // SEARCH_TAG_WORKER_QUEUE.start();
    MenuItemStorageClient.retrievePendingSearchTagQueueEntries()
        .then(entries => SEARCH_TAG_WORKER_QUEUE.add(...entries))
        .catch(err => logError('Unable to retrieve pending search tag queue entries:', err));
}

startQueue();
