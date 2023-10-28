import cron from 'node-cron';
import { logError } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';

const updateWeeklyCafeMenusAsync = async () => {
    const currentWeekdayIndex = new Date().getDay();
    const startWeekdayIndex = Math.max(currentWeekdayIndex, 1);

    for (let i = startWeekdayIndex; i <= 5; i++) {
        const updateSession = new DailyCafeUpdateSession(i);
        await updateSession.populateAsync();
    }
}

const updateWeeklyCafeMenus = () => {
    updateWeeklyCafeMenusAsync()
        .catch(err => logError('Failed to update weekly cafe menus:', err));
}

export const scheduleWeeklyUpdateJob = () => {
    cron.schedule('0 12 * * 0', async () => {

    });
}