import type { ICafeService } from '../../../shared/services/cafe.js';
import { dataHandler } from './handler.js';

export const cafeService: ICafeService = {
    retrieveCafe: (data) =>
        dataHandler.sendRequest('cafe', 'retrieveCafe', data),
    retrieveCafes: (data) =>
        dataHandler.sendRequest('cafe', 'retrieveCafes', data),
    doesCafeExist: (data) =>
        dataHandler.sendRequest('cafe', 'doesCafeExist', data),
    createCafe: (data) =>
        dataHandler.sendRequest('cafe', 'createCafe', data),
};
