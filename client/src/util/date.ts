import { nativeDayOfWeekNames } from '@msdining/common/util/date-util';

export const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

export const getWeekdayDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long'
});

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

        const startDateDisplay = nativeDayOfWeekNames[group[0]!];
        const endDateDisplay = nativeDayOfWeekNames[group[group.length - 1]!];
        return `${startDateDisplay} - ${endDateDisplay}`;
    }).join(', ');
};

export const getSmallestDate = (dates: Date[]): Date => {
    if (dates.length === 0) {
        throw new Error('Cannot get smallest date from an empty array');
    }

    let smallestDate = dates[0]!;
    for (const date of dates) {
        if (date.getTime() < smallestDate.getTime()) {
            smallestDate = date;
        }
    }

    return smallestDate;
}

export const getLargestDate = (dates: Date[]): Date => {
    if (dates.length === 0) {
        throw new Error('Cannot get largest date from an empty array');
    }

    let largestDate = dates[0]!;
    for (const date of dates) {
        if (date.getTime() > largestDate.getTime()) {
            largestDate = date;
        }
    }

    return largestDate;
}