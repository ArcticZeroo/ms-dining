import React, { useMemo } from 'react';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useSelectedDateInUrl } from '../../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
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

export const CafeDatePicker: React.FC = () => {
    const selectedDate = useSelectedDate();
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    useSelectedDateInUrl();

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

    // Don't render anything when the user can't change the date AND the
    // selected date already matches today's actual calendar date. The
    // weekend-rollover case (selected date is Monday but today is Saturday)
    // still falls through so the user knows what date the menu reflects.
    if (!allowFutureMenus && DateUtil.isSameDate(selectedDate, new Date())) {
        return null;
    }

    // When future menus are disabled, the user can't actually change the
    // selected date, so we render as a read-only display.
    const showControls = allowFutureMenus;

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