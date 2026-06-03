import { IMenuItemBase } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { md5 } from '../../../../../shared/util/hash.js';
import { localeCompareSortAsc } from '../../../../../shared/util/sort.js';
import { usePrismaClient, usePrismaWrite } from '../../client.js';

export interface IStationThemeWorkItem {
    stationName: string;
    hash: string;
    itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>;
}

export abstract class StationThemeClient {
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

    static getHash(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>): string {
        return md5(StationThemeClient.serializeItemsByCategory(itemsByCategory));
    }

    static async retrieveThemeByHash(hash: string): Promise<string | undefined> {
        const themeObject = await usePrismaClient(
            prismaClient => prismaClient.stationTheme.findUnique({
                where: {
                    itemHash: hash
                }
            })
        );

        return themeObject?.theme;
    }

    static async saveThemeAsync(hash: string, theme: string): Promise<void> {
        await usePrismaWrite(prismaClient => prismaClient.stationTheme.create({
            data: {
                itemHash: hash,
                theme
            }
        }));
    }

    static async retrieveThemeAsync(itemsByCategory: Map<string /*categoryName*/, Array<IMenuItemBase>>): Promise<string | undefined> {
        if (itemsByCategory.size === 0) {
            return undefined;
        }

        const hash = StationThemeClient.getHash(itemsByCategory);
        return StationThemeClient.retrieveThemeByHash(hash);
    }
}