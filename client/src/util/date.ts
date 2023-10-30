import Duration from '@arcticzeroo/duration';

export const addDurationToDate = (date: Date, time: Duration) => {
    const result = new Date(date.getTime());
    result.setMilliseconds(result.getMilliseconds() + time.inMilliseconds);
    return result;
};

export const nativeDayValues = {
    Sunday:    0,
    Monday:    1,
    Tuesday:   2,
    Wednesday: 3,
    Thursday:  4,
    Friday:    5,
    Saturday:  6
};

export const nativeDayOfWeek = {
    Sunday:    0,
    Monday:    1,
    Tuesday:   2,
    Wednesday: 3,
    Thursday:  4,
    Friday:    5,
    Saturday:  6
};

const padDateValue = (value: number) => value.toString().padStart(2, '0');

export const toDateString = (date: Date) => `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;
export const fromDateString = (dateString: string) => new Date(`${dateString}T00:00`);

export const isDateOnWeekend = (date: Date) => {
    const dayOfWeek = date.getDay();
    return [nativeDayOfWeek.Saturday, nativeDayOfWeek.Sunday].includes(dayOfWeek);
};

export const isSameDate = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export const isDateBefore = (date: Date, compareDate: Date) => {
    return date.getFullYear() < compareDate.getFullYear()
        || date.getMonth() < compareDate.getMonth()
        || date.getDate() < compareDate.getDate();
}

export const isDateAfter = (date: Date, compareDate: Date) => {
    return date.getFullYear() > compareDate.getFullYear()
        || date.getMonth() > compareDate.getMonth()
        || date.getDate() > compareDate.getDate();
}

export const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

export const getWeekdayDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long'
});
