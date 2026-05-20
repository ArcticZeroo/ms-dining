import type { IMenuItemBase } from '@msdining/common/models/cafe';

export interface IStationThemeService {
    /**
     * Get the AI-generated theme summary for a station's menu.
     * Returns undefined if the station has no menu items or if theme generation fails.
     * Results are cached by content hash.
     */
    retrieveTheme(data: {
        stationName: string;
        itemsByCategory: Map<string, IMenuItemBase[]>;
    }): Promise<string | undefined>;
}
