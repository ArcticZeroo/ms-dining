import { DiningHallDiscoverySession } from './dining-hall.js';
import cron from 'node-cron';
import { diningHalls } from '../../constants/dining-halls.js';

export const diningHallSessionsByUrl = new Map<string, DiningHallDiscoverySession>();

const populateSessionsAsync = async () => {
    diningHallSessionsByUrl.clear();

    for (const diningHall of diningHalls) {
        const session = new DiningHallDiscoverySession(diningHall);
        try {
            console.log('Performing discovery for', diningHall.friendlyName, 'at', diningHall.url, '...');
            await session.performDiscoveryAsync();
            diningHallSessionsByUrl.set(diningHall.url, session);
        } catch (e) {
            console.error(`Failed to populate dining hall ${diningHall.friendlyName} (${diningHall.url})`, e);
        }
    }
};

const populateSessions = () => {
    populateSessionsAsync()
        .catch(e => console.error('Failed to populate dining hall sessions', e));
};

// 9am on Monday through Friday
cron.schedule('0 9 * * 1,2,3,4,5', () => {
    populateSessions();
});

populateSessions();