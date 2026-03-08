import { IMenuItemBase } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { isDev } from '../../../util/env.js';
import { md5 } from '../../../util/hash.js';
import { logDebug, logError } from '../../../util/log.js';
import { localeCompareSortAsc } from '../../../util/sort.js';
import { retrieveTextCompletion } from '../../ai/index.js';
import { usePrismaClient } from '../client.js';

const STATION_THEME_SYSTEM_PROMPT = 'You are an expert writer who summarizes rotating cafeteria menus.';

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

abstract class StationThemeLocalClient {
    static async retrieveThemeAsync(hash: string): Promise<string | undefined> {
        const themeObject = await usePrismaClient(
            prismaClient => prismaClient.stationTheme.findUnique({
                where: {
                    itemHash: hash
                }
            })
        );

        return themeObject?.theme;
    }

    static async saveThemeAsync(hash: string, theme: string | undefined): Promise<void> {
        if (theme == null) {
            theme = '';
        }

        await usePrismaClient(prismaClient => prismaClient.stationTheme.create({
            data: {
                itemHash: hash,
                theme:    theme!
            }
        }));
    }
}

export abstract class StationThemeClient {
    static #activeThemeRequests = new Map<string /*hash*/, Promise<string | undefined>>();

    static serializeItemsByCategory(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>) {
        return Array.from(itemsByCategory.entries())
            .map(([categoryName, items]) => (
                `${categoryName}=${
                    items.map(item => normalizeNameForSearch(item.name))
                        .sort(localeCompareSortAsc)
                        .join(',')
                }`
            ))
            .sort(localeCompareSortAsc)
            .join(';');
    }

    static #getHash(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>): string {
        return md5(StationThemeClient.serializeItemsByCategory(itemsByCategory));
    }

    static async #initializeTheme(stationName: string, hash: string, itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>): Promise<string | undefined> {
        try {
            if (isDev) {
                logDebug(`Getting station theme for station contents: ${StationThemeClient.serializeItemsByCategory(itemsByCategory)}`);
            }

            const theme = await retrieveTextCompletion({
                systemPrompt: STATION_THEME_SYSTEM_PROMPT,
                userMessage:  getThemePrompt(stationName, itemsByCategory)
            });

            if (isDev) {
                logDebug(`Theme for ${StationThemeClient.serializeItemsByCategory(itemsByCategory)}: ${theme}`);
            }

            await StationThemeLocalClient.saveThemeAsync(hash, theme);

            return theme;
        } catch (err) {
            logError(`Could not save theme for hash ${hash}:`, err);
        }

        return undefined;
    }

    static async retrieveThemeAsync(stationName: string, itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>): Promise<string | undefined> {
        if (itemsByCategory.size === 0) {
            return undefined;
        }

        const hash = StationThemeClient.#getHash(itemsByCategory);

        const existingTheme = await StationThemeLocalClient.retrieveThemeAsync(hash);
        if (existingTheme) {
            return existingTheme;
        }

        try {
            const themePromise = StationThemeClient.#activeThemeRequests.get(hash) ?? StationThemeClient.#initializeTheme(stationName, hash, itemsByCategory);
            StationThemeClient.#activeThemeRequests.set(hash, themePromise);

            return await themePromise;
        } finally {
            StationThemeClient.#activeThemeRequests.delete(hash);
        }
    }
}