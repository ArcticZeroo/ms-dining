import { CafeDiscoverySession } from './session.js';
import cron from 'node-cron';
import { cafeList } from '../../constants/cafes.js';
import { logError, logInfo } from '../../util/log.js';

export const cafeSessionsByUrl = new Map<string, CafeDiscoverySession>();

const populateSessionsAsync = async () => {
    cafeSessionsByUrl.clear();

    logInfo('Populating cafe sessions...');

    for (const cafe of cafeList) {
        const session = new CafeDiscoverySession(cafe);
        try {
            logInfo('Performing discovery for', cafe.name, 'at', cafe.url, '...');
            await session.performDiscoveryAsync();
            cafeSessionsByUrl.set(cafe.url, session);
        } catch (e) {
            logError(`Failed to populate cafe ${cafe.name} (${cafe.url})`, e);
        }
    }

    logInfo('Finished populating cafe sessions');
};

const populateSessions = () => {
    populateSessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

// 9am on Monday through Friday
cron.schedule('0 9 * * 1,2,3,4,5', () => {
    populateSessions();
});

populateSessions();