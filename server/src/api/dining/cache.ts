import { DiningHallDiscoverySession } from './dining-hall.js';
import cron from 'node-cron';
import { diningHalls } from '../../constants/dining-halls.js';
import { logError, logInfo } from '../../util/log.js';

export const diningHallSessionsByUrl = new Map<string, DiningHallDiscoverySession>();

const populateSessionsAsync = async () => {
    diningHallSessionsByUrl.clear();

    logInfo('Populating dining hall sessions...');

    for (const diningHall of diningHalls) {
        const session = new DiningHallDiscoverySession(diningHall);
        try {
            logInfo('Performing discovery for', diningHall.name, 'at', diningHall.url, '...');
            await session.performDiscoveryAsync();
            diningHallSessionsByUrl.set(diningHall.url, session);
        } catch (e) {
            logError(`Failed to populate dining hall ${diningHall.name} (${diningHall.url})`, e);
        }
    }

    logInfo('Finished populating dining hall sessions');
};

const populateSessions = () => {
    populateSessionsAsync()
        .catch(e => logError('Failed to populate dining hall sessions', e));
};

// 9am on Monday through Friday
cron.schedule('0 9 * * 1,2,3,4,5', () => {
    populateSessions();
});

populateSessions();