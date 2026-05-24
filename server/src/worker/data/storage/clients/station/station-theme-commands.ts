import { IMenuItemBase } from '@msdining/common/models/cafe';
import type { IStationThemeService } from '../../../../../shared/services/station-theme.js';
import { StationThemeClient } from './station-theme.js';

export const stationThemeServiceCommands = {
    retrieveTheme: async ({ stationName, itemsByCategory }: {
        stationName: string;
        itemsByCategory: Map<string, IMenuItemBase[]>;
    }) =>
        StationThemeClient.retrieveThemeAsync(stationName, itemsByCategory),
} satisfies IStationThemeService;
