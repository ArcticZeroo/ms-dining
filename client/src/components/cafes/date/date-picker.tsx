import React, { useMemo } from 'react';
import { useSelectedDate, setSelectedDate } from '../../../store/zustand/selected-date.ts';
import { DiningClient } from '../../../api/client/dining.ts';

import { FutureMenuOutOfDateNotice } from '../../notice/future-menu-out-of-date-notice.tsx';
import { DateUtil } from '@msdining/common';
import { getDateDisplay } from '../../../util/date.ts';

import './date-picker.css';

const getPreviousDate = (date: Date) => {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() - 1);

    while (DateUtil.isDateOnWeekend(newDate)) {
        newDate.setDate(newDate.getDate() - 1);
    }

    return newDate;
};

const getNextDate = (date: Date) => {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() + 1);

    while (DateUtil.isDateOnWeekend(newDate)) {
        newDate.setDate(newDate.getDate() + 1);
    }

    return newDate;
};

const MINIMUM_DATE = DateUtil.getMinimumDateForMenu();
const MAXIMUM_DATE = DateUtil.getMaximumDateForMenu();

interface ICafeDatePickerProps {
    /**
     * When false, the prev/today/next buttons are hidden and the picker is
     * just an informational display of the currently-selected date. Used when
     * future menus are disabled but the selected date is still not today
     * (e.g. weekend rollover landed on Monday) so the user understands what
     * date the menu is for.
     */
    showControls?: boolean;
}

export const CafeDatePicker: React.FC<ICafeDatePickerProps> = ({ showControls = true }) => {
    const selectedDate = useSelectedDate();

    const {
        previousDate,
        nextDate,
        canGoBackwards,
        canGoForwards,
        isAtToday,
        previousDateDisplay,
        nextDateDisplay,
        selectedDateDisplay
    } = useMemo(() => {
        const previousDate = getPreviousDate(selectedDate);
        const nextDate = getNextDate(selectedDate);
        const canGoBackwards = DateUtil.isDateAfter(selectedDate, MINIMUM_DATE);
        const canGoForwards = DateUtil.isDateBefore(selectedDate, MAXIMUM_DATE);
        const isAtToday = DateUtil.isSameDate(selectedDate, DiningClient.getTodayDateForMenu());

        const previousDateDisplay = getDateDisplay(previousDate);
        const nextDateDisplay = getDateDisplay(nextDate);
        const selectedDateDisplay = getDateDisplay(selectedDate);

        return {
            previousDate,
            nextDate,
            canGoBackwards,
            canGoForwards,
            isAtToday,
            previousDateDisplay,
            nextDateDisplay,
            selectedDateDisplay
        };
    }, [selectedDate]);

    const goBackwards = () => {
        if (!canGoBackwards) {
            return;
        }

        setSelectedDate(previousDate);
    };

    const goToToday = () => {
        if (isAtToday) {
            return;
        }

        setSelectedDate(DiningClient.getTodayDateForMenu());
    };

    const goForwards = () => {
        if (!canGoForwards) {
            return;
        }

        setSelectedDate(nextDate);
    };

    return (
        <div className="date-picker">
            {showControls && (
                <div className="date-picker-buttons">
                    <button onClick={goBackwards} className="date-picker-button" disabled={!canGoBackwards}
                        title={`Go to ${previousDateDisplay}`}>
                        <span className="material-symbols-outlined">
                            arrow_back
                        </span>
                    </button>
                    <button onClick={goToToday} className="date-picker-button" disabled={isAtToday} title={'Go to Today'}>
                        <span className="material-symbols-outlined">
                            today
                        </span>
                    </button>
                    <button onClick={goForwards} className="date-picker-button" disabled={!canGoForwards}
                        title={`Go to ${nextDateDisplay}`}>
                        <span className="material-symbols-outlined">
                            arrow_forward
                        </span>
                    </button>
                </div>
            )}
            {selectedDateDisplay}
            <FutureMenuOutOfDateNotice/>
        </div>
    );
};