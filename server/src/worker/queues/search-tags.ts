import Duration from '@arcticzeroo/duration';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { retrieveTextCompletion } from '../../api/ai/index.js';
import { MenuItemStorageClient } from '../../api/storage/clients/menu-item.js';
import { IMenuItemForAi } from '../../models/openai.js';
import { Nullable } from '../../models/util.js';
import { runPromiseWithRetries } from '../../util/async.js';
import { logDebug, logError } from '../../util/log.js';
import { WorkerQueue } from './queue.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 5 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 15 });

const SEARCH_TAGS_SYSTEM_PROMPT = 'You are a helpful assistant that generates search tags for menu items.';

const getSearchTagsPrompt = ({ name, description }: IMenuItemForAi) => (
    `Please provide a list of one-word tags that describe the following menu item, based on the name${description ? ' and description' : ''}.
    Tags will be used for users to search for this item. They should represent categories for the item rather than words directly in the item's name or description.
    Tags may only contain letters, they should not have numbers, punctuation, or special characters.
    Please respond only with the tag names, separated by commas.

    Some examples:
    for "chocolate cake", you might respond with: dessert, sweets
    for "green beans", you might respond with: vegetables, side

    Menu Item Name: ${name}
    ${description ? `Menu Item Description: ${description}` : ''}
    Tags:`.trim()
);

const retrieveMenuItemSearchTagsFromAi = async (menuItem: IMenuItemForAi): Promise<Set<string>> => {
    logDebug('Retrieving search tags for menu item:', menuItem.name, menuItem.description);
    const response = await retrieveTextCompletion({
        systemPrompt: SEARCH_TAGS_SYSTEM_PROMPT,
        userMessage:  getSearchTagsPrompt(menuItem)
    });

    const rawTags = response.trim().split(',').map(tag => tag.trim());

    // The AI must return at least one tag per menu item for this to be considered a success
    if (rawTags.length === 0) {
        throw new Error('AI did not return any tags');
    }

    const resultTags = new Set<string>();

    for (const rawTag of rawTags) {
        const normalizedTag = rawTag.trim().toLowerCase().replaceAll(/[^a-zA-Z\s]/g, '');
        resultTags.add(normalizedTag);
    }

    logDebug('Retrieved search tags:', resultTags);

    return resultTags;
};

const AI_RETRY_COUNT = 3;

const retrieveMenuItemSearchTagsFromAiWithRetries = async (menuItem: IMenuItemForAi): Promise<Set<string>> => (
    runPromiseWithRetries(() => retrieveMenuItemSearchTagsFromAi(menuItem), AI_RETRY_COUNT)
);

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