import cron from 'node-cron';
import { logError } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { nativeDayOfWeek } from '../../../util/date.js';

const updateWeeklyCafeMenusAsync = async () => {
    const currentWeekdayIndex = new Date().getDay();
    const startWeekdayIndex = Math.max(currentWeekdayIndex, nativeDayOfWeek.Monday);

    for (let i = startWeekdayIndex; i <= nativeDayOfWeek.Friday; i++) {
        const updateSession = new DailyCafeUpdateSession(i);
        await updateSession.populateAsync();
    }
}

const updateWeeklyCafeMenus = () => {
    updateWeeklyCafeMenusAsync()
        .catch(err => logError('Failed to update weekly cafe menus:', err));
}

export const scheduleWeeklyUpdateJob = () => {
    // Weekly update job runs every Friday at 10:00 AM
    cron.schedule('0 10 * * 5', async () => {
        updateWeeklyCafeMenus();
    });
}