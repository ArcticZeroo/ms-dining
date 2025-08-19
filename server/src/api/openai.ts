import { IMenuItemBase } from '@msdining/common/dist/models/cafe.js';
import OpenAI from 'openai';
import { getOpenAiKey } from '../constants/env.js';
import { ICafeStation, ICafe, CafeGroup } from '../models/cafe.js';
import { IMenuItemForAi } from '../models/openai.js';
import { runPromiseWithRetries } from '../util/async.js';
import { isDev } from '../util/env.js';
import { lazy } from '../util/lazy.js';
import { logDebug } from '../util/log.js';
import { StationThemeClient } from './storage/clients/station-theme.js';

const getClient = lazy(() => new OpenAI({
    apiKey: getOpenAiKey()
}));

const retrieveChatCompletion = async (question: string) => {
    // todo: handle 429
    const response = await getClient().chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
            {
                role: 'user',
                content: question
            }
        ]
    });

    const choice = response.choices[0];
    if (!choice) {
        throw new Error('AI did not return a choice');
    }

    const message = choice.message.content;
    if (!message) {
        throw new Error('AI chat completion did not return a message');
    }

    return message;
};

export const retrieveEmbeddings = async (text: string) => {
    const response = await getClient().embeddings.create({
        model: 'text-embedding-3-small',
        input: text
    });

    const data = response.data[0];
    if (!data) {
        throw new Error('AI did not return embeddings');
    }

    return data.embedding;
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

const getThemePrompt = (stationName: string, menuItemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>) => (
    `
    [Task Description]
    You are an expert writer. Each day our cafeteria has a rotating menu (for instance: tacos, mac and cheese, 
    chicken/eggplant parmesan, or orange chicken and eggplant at a rotating chinese food station). 
    
    Your job is to write a short summary of the rotating menu given the list of items available today. The summary
    will be used as a bullet point to quickly inform customers about the menu. The purpose of this summary is
    informational, not promotional. It should avoid marketing language/too many superfluous words and should be concise,
    but still cover all items on the menu.
    Don't include anything similar to "Today's menu includes" or "Today's special is" - just get to the point, this is 
    going to be a bullet point in a list.
    Menu item descriptions are meant to add context in case the name is not descriptive enough, don't list every 
    sub-ingredient in a menu item. Again, this is just a bullet point in a list, so keep it short. We don't need to know
    every ingredient listed for a pad thai - users will be able to click into the station to see details if they care.
    
    It should not just be a list of the items unless the menu is very small and there is no clear theme.
    Avoid repeating the station name directly in the summary.
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
);

const AI_RETRY_COUNT = 3;

const retrieveMenuItemSearchTagsFromAi = async (menuItem: IMenuItemForAi): Promise<Set<string>> => {
    logDebug('Retrieving search tags for menu item:', menuItem.name, menuItem.description);
    const response = await retrieveChatCompletion(getSearchTagsPrompt(menuItem));

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

export const retrieveMenuItemSearchTagsFromAiWithRetries = async (menuItem: IMenuItemForAi): Promise<Set<string>> => (
    runPromiseWithRetries(() => retrieveMenuItemSearchTagsFromAi(menuItem), AI_RETRY_COUNT)
);

export const retrieveStationThemeFromAi = async (stationName: string, menuItemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>) => {
    const prompt = getThemePrompt(stationName, menuItemsByCategory);

    return runPromiseWithRetries(
        async (i) => {
            if (isDev) {
                logDebug(`[${i}] Getting station theme for station contents: ${StationThemeClient.serializeItemsByCategory(menuItemsByCategory)}`);
            }

            const theme = await retrieveChatCompletion(prompt);

            if (isDev) {
                logDebug(`[${i}] Theme for ${StationThemeClient.serializeItemsByCategory(menuItemsByCategory)}: ${theme}`);
            }

            return theme;
        },
        AI_RETRY_COUNT
    );
};

const serializeMenuItemForEmbeddings = (menuItem: IMenuItemBase): string => {
    const parts = [
        `Menu Item Name: ${menuItem.name}`,
    ];

    if (menuItem.description) {
        parts.push(`Menu Item Description: ${menuItem.description}`);
    }

    if (menuItem.modifiers.length > 0) {
        parts.push(`Menu Item Modifiers:`);
        for (const modifier of menuItem.modifiers) {
            parts.push(`- ${modifier.description} [${modifier.choices.map(choice => choice.description).join(', ')}]`);
        }
    }

    if (menuItem.tags.size > 0) {
        parts.push(`Menu Item Tags: ${Array.from(menuItem.tags).join(', ')}`);
    }

    if (menuItem.searchTags.size > 0) {
        parts.push(`Menu Item Search Tags: ${Array.from(menuItem.searchTags).join(', ')}`);
    }

    return parts.join('\n');
};

export const retrieveMenuItemEmbeddings = async (menuItem: IMenuItemBase, categoryName: string, stationName: string) => {
    return retrieveEmbeddings(
        `
        Station Name: ${stationName}
        Category Name: ${categoryName}
        ${serializeMenuItemForEmbeddings(menuItem)}
    `);
}

export const retrieveStationEmbeddings = async (station: ICafeStation) => {
    const categoryStrings: string[] = [];
    for (const [categoryName, menuItemIds] of station.menuItemIdsByCategoryName.entries()) {
        const categoryStringParts = [`- Category Name: ${categoryName} [`];
        for (const menuItemId of menuItemIds) {
            const menuItem = station.menuItemsById.get(menuItemId);
            if (menuItem) {
                categoryStringParts.push(`-- { ${serializeMenuItemForEmbeddings(menuItem)} }`);
            }
        }
        categoryStringParts.push(']');
        categoryStrings.push(categoryStringParts.join('\n'));
    }

    return retrieveEmbeddings(`
        Station Name: ${station.name}
        Station Categories: ${categoryStrings.join('\n')}
    `);
}

export const retrieveCafeEmbeddings = async (cafe: ICafe, group?: CafeGroup) => {
    const parts = [`Cafe Name: ${cafe.name}`, `Cafe ID: ${cafe.id}`];

    if (cafe.shortName) {
        parts.push(`Cafe Short Name: ${cafe.shortName}`);
    }

    if (group) {
        parts.push(`Cafe Group: ${group.name}`);

        if (group.shortName) {
            parts.push(`Cafe Group Short Name: ${group.shortName}`);
        }

        for (const member of group.members) {
            if (member.id === cafe.id) {
                continue; // Skip the current cafe
            }

            parts.push(`Cafe Group Member: ${member.name} (${member.id})`);
        }
    }

    if (cafe.emoji) {
        parts.push(`Cafe Type Indicator: ${cafe.emoji}`);
    }

    return retrieveEmbeddings(parts.join('\n'));
}
