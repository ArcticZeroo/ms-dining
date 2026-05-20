import type { IStationService } from '../../../shared/services/station.js';
import { dataHandler } from './handler.js';

export const stationService: IStationService = {
    createStation: (data) =>
        dataHandler.sendRequest('station', 'createStation', data),
    retrieveStation: (data) =>
        dataHandler.sendRequest('station', 'retrieveStation', data),
    retrieveAllStationsWithoutGroup: (data) =>
        dataHandler.sendRequest('station', 'retrieveAllStationsWithoutGroup', data),
    retrieveAllStationNames: (data) =>
        dataHandler.sendRequest('station', 'retrieveAllStationNames', data),
};
