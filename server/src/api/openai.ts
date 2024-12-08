import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import { ChatGPTAPI } from 'chatgpt';
import { getChatGptKey, hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from '../constants/env.js';
import { IMenuItemForAi } from '../models/openai.js';
import { runPromiseWithRetries } from '../util/async.js';
import { isDev } from '../util/env.js';
import { lazy } from '../util/lazy.js';
import { logDebug } from '../util/log.js';
import { StationThemeClient } from './storage/clients/station-theme.js';

export const IS_OPENAI_ENABLED = hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.openAi);

const getClient = lazy(() => new ChatGPTAPI({
    apiKey: getChatGptKey(),
    completionParams: {
        model: 'gpt-3.5-turbo' // seems probably good enough and gives us 3500 requests per minute
    }
}));

const retrieveAiResponse = async (question: string) => {
    // todo: handle 429
    const response = await getClient().sendMessage(question);
    return response.text;
}

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

const getThemePrompt = (stationName: string, menuItemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>) => (
    `
    [Task Description]
    You are an expert writer. Each day our cafeteria has a rotating menu (for instance: tacos, mac and cheese, 
    chicken/eggplant parmesan, or orange chicken and eggplant at a rotating chinese food station). 
    Your job is to write a short summary of the rotating menu given the list of items available today.
    You will be given the station name, the list of categories and the item names/descriptions within those categories. 
    The summary should be descriptive but brief.
    [End Task Description]
    
    [Example]
    Today's station name: What The Pho
    
    Today's Menu:
    - [What The Pho]: "Pho Steak", "Pho Steak & Beef Meatballs", "Pho Steak & Veggies", "Pho Chicken", "Pho Chicken + Veg", "Pho Tofu & Veg"
    
    Today's theme: Beef/Chicken/Tofu Pho
    [End Example]
    
    [Example]
    Today's station name: Street Food
    
    Today's Menu:
    - [Tenders]: "Basic Chicken Tenders", "Spicy Buffalo Tenders", "Sweet Chili Chicken Tenders", "General Tso Chicken Tenders"
    - [Cauliflower Tenders]: "Basic Cauliflower Tenders", "Spicy Buffalo Cauliflower Tenders", "Sweet Chili Cauliflower Tenders", "General Tso Cauliflower Tenders"
    
    Today's theme: Flavored Chicken or Cauliflower Tenders
    [End Example]
    
    [Example]
    Today's station name: Street Food
    
    Today's Menu:
    - [Tenders]: "Basic Chicken Tenders", "Spicy Buffalo Tenders", "Sweet Chili Chicken Tenders", "General Tso Chicken Tenders"
    - [Cauliflower Tenders]: "Basic Cauliflower Tenders", "Spicy Buffalo Cauliflower Tenders", "Sweet Chili Cauliflower Tenders", "General Tso Cauliflower Tenders"
    
    Today's theme: Flavored Chicken or Cauliflower Tenders
    [End Example]
    
    [Example]
    Today's station name: Facing East
    
    Today's Menu:
    - [Lunch Box]: "3 Cup Chicken Bento", "Beef Stew Bento", "Pork Belly Bento", "Vegetarian Bento"
    
    Today's theme: Chicken/Beef/Pork/Vegetarian Bento Boxes
    [End Example]

    Today's station name: "${stationName}"

    Today's menu:
    ${Array.from(menuItemsByCategory.entries()).map(([category, menuItems]) => (
        `- [${category}]: ${menuItems.map(menuItem => `"${menuItem.name}"${menuItem.description && ` (Description: '${menuItem.description}')`}`).join(', ')}`
    ))}
    
    Today's theme:`.trim()
)

const AI_RETRY_COUNT = 3;

const retrieveMenuItemSearchTagsFromAi = async (menuItem: IMenuItemForAi): Promise<Set<string>> => {
    logDebug('Retrieving search tags for menu item:', menuItem.name, menuItem.description)
    const response = await retrieveAiResponse(getSearchTagsPrompt(menuItem));

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

export const retrieveMenuItemSearchTagsFromAiWithRetries = async (menuItem: IMenuItemForAi): Promise<Set<string>> => (
    runPromiseWithRetries(() => retrieveMenuItemSearchTagsFromAi(menuItem), AI_RETRY_COUNT)
);

export const retrieveStationThemeFromAi = async (stationName: string, menuItemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>) => {
    const prompt = getThemePrompt(stationName, menuItemsByCategory);

    return runPromiseWithRetries(
        async (i) => {
            if (isDev) {
                logDebug(`[${i}] Getting station theme for station contents: ${StationThemeClient.serializeItemsByCategory(menuItemsByCategory)}`);
            }

            const theme = await retrieveAiResponse(prompt);

            if (isDev) {
                logDebug(`[${i}] Theme for ${StationThemeClient.serializeItemsByCategory(menuItemsByCategory)}: ${theme}`);
            }

            return theme;
        },
        AI_RETRY_COUNT
    );
};