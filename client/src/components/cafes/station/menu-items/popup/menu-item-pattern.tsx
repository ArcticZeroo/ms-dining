import { IAvailabilityPattern } from "@msdining/common/dist/models/pattern";
import React from "react";
import { isEveryDayPattern } from "@msdining/common/dist/util/pattern";
import { nativeDayOfWeekNames } from "@msdining/common/dist/util/date-util";
import { Nullable } from "@msdining/common/dist/models/util";

const getPatternString = (pattern: IAvailabilityPattern): string => {
    if (isEveryDayPattern(pattern)) {
        return 'Available every day';
    }

    const dayString = pattern.weekdays.size === 5
        ? 'Monday through Friday'
        : `on ${Array.from(pattern.weekdays).map(weekday => nativeDayOfWeekNames[weekday]).join(', ')}`;

    return `Available every ${pattern.gap === 1 ? 'week' : `${pattern.gap} weeks`}, ${dayString}`;
}

interface IMenuItemPatternProps {
    pattern: Nullable<IAvailabilityPattern>;
}

export const MenuItemPattern: React.FC<IMenuItemPatternProps> = ({ pattern }) => {
    if (pattern == null) {
        return null;
    }

    return (
        <div className="menu-item-pattern">
            {getPatternString(pattern)}
        </div>
    );
}