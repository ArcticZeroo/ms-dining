import { SelectedDateContext } from '../../../context/time.ts';
import React, { useContext, useMemo } from 'react';
import { useValueNotifier } from '../../../hooks/events.ts';
import { DiningClient } from '../../../api/dining.ts';
import { isSameDate, isDateOnWeekend, isDateAfter, isDateBefore } from '../../../util/date.ts';

import './date-picker.css';

const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

const getPreviousDate = (date: Date) => {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() - 1);

    while (isDateOnWeekend(newDate)) {
        newDate.setDate(newDate.getDate() - 1);
    }

    return newDate;
}

const getNextDate = (date: Date) => {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() + 1);

    while (isDateOnWeekend(newDate)) {
        newDate.setDate(newDate.getDate() + 1);
    }

    return newDate;
}

export const CafeDatePicker: React.FC = () => {
    const selectedDateNotifier = useContext(SelectedDateContext);
    const selectedDate = useValueNotifier(selectedDateNotifier);

    const previousDate = useMemo(() => getPreviousDate(selectedDate), [selectedDate]);
    const nextDate = useMemo(() => getNextDate(selectedDate), [selectedDate]);

    const minimumDate = DiningClient.getMinimumDateForMenu();
    const maximumDate = DiningClient.getMaximumDateForMenu();

    console.log(selectedDate, minimumDate, maximumDate);

    const canGoBackwards = isDateAfter(selectedDate, minimumDate);
    const canGoForwards = isDateBefore(selectedDate, maximumDate);
    const isAtToday = isSameDate(selectedDate, DiningClient.getTodayDateForMenu());

    const goBackwards = () => {
        if (!canGoBackwards) {
            return;
        }

        selectedDateNotifier.value = previousDate;
    };

    const goToToday = () => {
        if (isAtToday) {
            return;
        }

        selectedDateNotifier.value = DiningClient.getTodayDateForMenu();
    }

    const goForwards = () => {
        if (!canGoForwards) {
            return;
        }

        selectedDateNotifier.value = nextDate;
    };

    return (
        <div className="date-picker">
            <div className="date-picker-buttons">
                <button onClick={goBackwards} className="date-picker-button" disabled={!canGoBackwards} title={`Go to ${getDateDisplay(previousDate)}`}>
                    <span className="material-symbols-outlined">
                        arrow_back
                    </span>
                </button>
                <button onClick={goToToday} className="date-picker-button" disabled={isAtToday} title={`Go to Today`}>
                    <span className="material-symbols-outlined">
                        today
                    </span>
                </button>
                <button onClick={goForwards} className="date-picker-button" disabled={!canGoForwards} title={`Go to ${getDateDisplay(nextDate)}`}>
                    <span className="material-symbols-outlined">
                        arrow_forward
                    </span>
                </button>
            </div>
            {getDateDisplay(selectedDate)}
        </div>
    );
};