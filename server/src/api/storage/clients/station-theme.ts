import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { md5 } from '../../../util/hash.js';
import { logError } from '../../../util/log.js';
import { localeCompareSortAsc } from '../../../util/sort.js';
import { retrieveStationThemeFromAi } from '../../openai.js';
import { usePrismaClient } from '../client.js';

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

    static serializeItemsByCategory(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>) {
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

    static #getHash(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>): string {
        return md5(StationThemeClient.serializeItemsByCategory(itemsByCategory));
    }

    static async #initializeTheme(stationName: string, hash: string, itemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>): Promise<string | undefined> {
        try {
            const theme = await retrieveStationThemeFromAi(stationName, itemsByCategory);

            await StationThemeLocalClient.saveThemeAsync(hash, theme);

            return theme;
        } catch (err) {
            logError(`Could not save theme for hash ${hash}:`, err);
        }

        return undefined;
    }

    static async retrieveThemeAsync(stationName: string, itemsByCategory: Map<string /*categoryName*/, Array<IMenuItem>>): Promise<string | undefined> {
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