import Duration from '@arcticzeroo/duration';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { Nullable } from '../../shared/models/util.js';
import { StationThemeClient, IStationThemeWorkItem } from '../data/storage/clients/station/station-theme.js';
import { retrieveTextCompletion } from '../../shared/ai/index.js';
import { isDev } from '../../shared/util/env.js';
import { logDebug } from '../../shared/util/log.js';
import { WorkerQueue } from './queue.js';

const QUEUE_SUCCESS_POLL_INTERVAL = new Duration({ seconds: 3 });
const QUEUE_EMPTY_POLL_INTERVAL = new Duration({ seconds: 15 });
const QUEUE_FAILED_POLL_INTERVAL = new Duration({ seconds: 15 });

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

class StationThemeWorkerQueue extends WorkerQueue<string, IStationThemeWorkItem> {
    constructor() {
        super({
            successPollInterval: QUEUE_SUCCESS_POLL_INTERVAL,
            emptyPollInterval:   QUEUE_EMPTY_POLL_INTERVAL,
            failedPollInterval:  QUEUE_FAILED_POLL_INTERVAL,
        });

        this.start();
    }

    protected getKey(entry: IStationThemeWorkItem): string {
        return entry.hash;
    }

    async doWorkAsync(entry: IStationThemeWorkItem): Promise<void | Nullable<symbol>> {
        const existingTheme = await StationThemeClient.retrieveThemeByHash(entry.hash);
        if (existingTheme != null) {
            return WorkerQueue.QUEUE_SKIP_ENTRY;
        }

        if (isDev) {
            logDebug(`Getting station theme for station contents: ${StationThemeClient.serializeItemsByCategory(entry.itemsByCategory)}`);
        }

        const theme = await retrieveTextCompletion({
            systemPrompt: STATION_THEME_SYSTEM_PROMPT,
            userMessage:  getThemePrompt(entry.stationName, entry.itemsByCategory)
        });

        if (isDev) {
            logDebug(`Theme for ${StationThemeClient.serializeItemsByCategory(entry.itemsByCategory)}: ${theme}`);
        }

        await StationThemeClient.saveThemeAsync(entry.hash, theme);
    }

    public enqueueTheme(stationName: string, itemsByCategory: Map<string, IMenuItemBase[]>) {
        if (itemsByCategory.size === 0) {
            return;
        }

        const hash = StationThemeClient.getHash(itemsByCategory);
        this.add({
            stationName,
            hash,
            itemsByCategory,
        });
    }
}

export const STATION_THEME_WORKER_QUEUE = new StationThemeWorkerQueue();