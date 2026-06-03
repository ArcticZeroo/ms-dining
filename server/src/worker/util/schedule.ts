import { MEAL_PERIOD } from '../../shared/constants/enum.js';

const DAY_ABBREVIATIONS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const minutesToCron = (minutesSinceMidnight: number, dayOfWeek: number): string => {
    const hour = Math.floor(minutesSinceMidnight / 60);
    const min = minutesSinceMidnight % 60;
    return `0 ${min} ${hour} * * ${DAY_ABBREVIATIONS[dayOfWeek]}`;
};

interface IConceptScheduleTaskItem {
    '@c': '.DisplayProfileTask' | '.TransitionTask';
    scheduledExpression: string;
    properties?: Record<string, unknown>;
    displayProfileState?: Record<string, unknown>;
}

interface IConceptSchedule {
    openScheduleExpression: string;
    closeScheduleExpression: string;
    schedule: Array<IConceptScheduleTaskItem>;
}

interface IGetConceptScheduleOptions {
    conceptId: string;
    menuId: string;
    displayProfileId: string;
    opensAtMinutes: number;
    closesAtMinutes: number;
    dayOfWeek: number;
}

export const createStationSchedule = ({
    conceptId,
    menuId,
    displayProfileId,
    opensAtMinutes,
    closesAtMinutes,
    dayOfWeek
}: IGetConceptScheduleOptions): IConceptSchedule => {
    const openCron = minutesToCron(opensAtMinutes, dayOfWeek);
    const closeCron = minutesToCron(closesAtMinutes, dayOfWeek);

    return {
        openScheduleExpression:  openCron,
        closeScheduleExpression: closeCron,
        schedule:                [
            {
                '@c':                  '.DisplayProfileTask',
                'scheduledExpression': openCron,
                'properties':          { 'meal-period-id': String(MEAL_PERIOD.lunch) },
                'displayProfileState': {
                    displayProfileId,
                    conceptStates: [{ conceptId, menuId }],
                },
            },
            {
                '@c':                  '.TransitionTask',
                'scheduledExpression': closeCron,
                'properties':          { 'TRANSITION_MESSAGE': '' },
            },
        ],
    };
};
