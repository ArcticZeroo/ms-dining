import { ChatGPTAPI } from 'chatgpt';
import { getChatGptKey } from '../constants/env.js';
import { IMenuItem } from '../models/cafe.js';
import { Nullable } from '../models/util.js';
import { logDebug, logError } from '../util/log.js';

const api = new ChatGPTAPI({
    apiKey: getChatGptKey(),
});

export const retrieveResponseText = async (question: string) => {
    const response = await api.sendMessage(question);
    return response.text;
}

const getMenuItemPrompt = (name: string, description: Nullable<string>) => (
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

const MENU_ITEM_SEARCH_TAGS_RETRY_COUNT = 3;

const retrieveMenuItemSearchTagsFromAi = async (name: string, description: Nullable<string>): Promise<Set<string>> => {
    logDebug('Retrieving search tags for menu item:', name, description)
    const response = await retrieveResponseText(getMenuItemPrompt(name, description));

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
}

export const retrieveMenuItemSearchTagsFromAiWithRetries = async (name: string, description: Nullable<string>): Promise<Set<string>> => {
    for (let i = 0; i < MENU_ITEM_SEARCH_TAGS_RETRY_COUNT; i++) {
        try {
            return await retrieveMenuItemSearchTagsFromAi(name, description);
        } catch (err) {
            logError(`Unable to retrieve search tags for menu item "${name}":`, err);
            if (i === (MENU_ITEM_SEARCH_TAGS_RETRY_COUNT - 1)) {
                throw err;
            }
        }
    }

    throw new Error('Unreachable: did not retrieve search tags');
}