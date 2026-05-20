import type { IStationThemeService } from '../../../shared/services/station-theme.js';
import { dataHandler } from './handler.js';

export const stationThemeService: IStationThemeService = {
    retrieveTheme: (data) =>
        dataHandler.sendRequest('stationTheme', 'retrieveTheme', data),
};
