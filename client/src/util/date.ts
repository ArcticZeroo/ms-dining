import { isSameDate, nativeDayOfWeekNames } from '@msdining/common/dist/util/date-util';

export const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

export const getWeekdayDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long'
});

export const getNextDay = (date: Date) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
}

export const getSequentialDateGroups = (dates: Date[], minGroupSizeToAvoidBreakup: number = 0): Array<Array<Date>> => {
    const groups: Array<Array<Date>> = [];
    let currentGroup: Array<Date> = [];
    for (const date of dates) {
        if (currentGroup.length < 1) {
            currentGroup = [date];
            groups.push(currentGroup);
            continue;
        }

        const lastDate = currentGroup[currentGroup.length - 1]!;
        if (isSameDate(getNextDay(lastDate), date) || isSameDate(getNextDay(date), lastDate)) {
            currentGroup.push(date);
            continue;
        }

        if (currentGroup.length < minGroupSizeToAvoidBreakup) {
            for (let i = 1; i < currentGroup.length; i++) {
                groups.push([currentGroup[i]]);
            }

            currentGroup.splice(1, currentGroup.length - 1);
        }

        currentGroup = [date];
        groups.push(currentGroup);
    }

    return groups;
};

const getSequentialWeekdayGroups = (weekdays: number[]): Array<Array<number>> => {
    const groups: Array<Array<number>> = [];
    let currentGroup: Array<number> = [];
    for (const weekday of weekdays) {
        if (currentGroup.length < 1) {
            currentGroup = [weekday];
            groups.push(currentGroup);
            continue;
        }

        const lastDate = currentGroup[currentGroup.length - 1]!;
        if (lastDate + 1 === weekday) {
            currentGroup.push(weekday);
            continue;
        }

        currentGroup = [weekday];
        groups.push(currentGroup);
    }

    return groups;
};

export const getLocationDatesDisplay = (sortedDates: Date[] | number[]) => {
    const weekdays = typeof sortedDates[0] === 'number'
        ? (sortedDates as number[])
        : (sortedDates as Date[]).map(date => date.getDay());

    const groups = getSequentialWeekdayGroups(weekdays);
    return groups.map(group => {
        if (group.length <= 2) {
            return group.map(weekday => nativeDayOfWeekNames[weekday]).join(', ');
        }

        const startDateDisplay = nativeDayOfWeekNames[group[0]];
        const endDateDisplay = nativeDayOfWeekNames[group[group.length - 1]];
        return `${startDateDisplay} - ${endDateDisplay}`;
    }).join(', ');
};

export const getSmallestDate = (dates: Date[]): Date => {
    let smallestDate = dates[0];
    for (const date of dates) {
        if (date.getTime() < smallestDate.getTime()) {
            smallestDate = date;
        }
    }

    return smallestDate;
}

export const getLargestDate = (dates: Date[]): Date => {
    let largestDate = dates[0];
    for (const date of dates) {
        if (date.getTime() > largestDate.getTime()) {
            largestDate = date;
        }
    }

    return largestDate;
}