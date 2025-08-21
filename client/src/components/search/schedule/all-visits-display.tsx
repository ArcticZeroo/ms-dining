import React from 'react';
import { IPatternData } from '@msdining/common/dist/util/pattern-util';
import { getLargestDate } from '../../../util/date.ts';
import { getSequentialDateGroups } from '@msdining/common/dist/util/date-util';
import { pluralize } from '../../../util/string.ts';

const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

interface IAllVisitsDisplayProps {
    pattern: IPatternData;
}

export const AllVisitsDisplay: React.FC<IAllVisitsDisplayProps> = ({ pattern }) => {
    if (pattern.isEveryWeekday || pattern.allVisits.length === 0) {
        return null;
    }

    if (pattern.visitsWithoutPattern.length === 0) {
        const lastVisit = getLargestDate(pattern.allVisits);

        return (
            <div className="flex">
                <span className="material-symbols-outlined">
                    history
                </span>
                <span>
                    Last visit: {getDateDisplay(lastVisit)}
                </span>
            </div>
        );
    }

    const sequentialVisitGroups = getSequentialDateGroups(pattern.allVisits, 3);
    const visitGroupStrings = sequentialVisitGroups.map(group => {
        if (group.length === 0) {
            throw new Error('Unexpected empty group in sequential visit groups');
        }

        if (group.length === 1) {
            return getDateDisplay(group[0]!);
        }

        group.sort((a, b) => a.getTime() - b.getTime());
        return `${getDateDisplay(group[0]!)} - ${getDateDisplay(group[group.length - 1]!)}`;
    });

    return (
        <div className="flex flex-col">
            <div className="flex">
                <span className="material-symbols-outlined">
                    history
                </span>
                <span>
                    {pattern.allVisits.length} {pluralize('visit', pattern.allVisits.length)} in the last month:
                </span>
            </div>
            <div className="flex flex-col">
                {visitGroupStrings.map(groupString => <span key={groupString}>{groupString}</span>)}
            </div>
        </div>
    );
};
