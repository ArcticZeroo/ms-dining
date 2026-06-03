import type { IStationThemeService } from '../../../../../shared/services/station-theme.js';
import { StationThemeClient } from './station-theme.js';

export const stationThemeServiceCommands = {
    retrieveTheme: async ({ itemsByCategory }) => StationThemeClient.retrieveThemeAsync(itemsByCategory),
} satisfies IStationThemeService;
