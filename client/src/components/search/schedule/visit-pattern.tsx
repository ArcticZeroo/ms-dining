import React, { useContext } from 'react';
import { calculatePattern, IPatternData } from '@msdining/common/dist/util/pattern-util';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';
import { closeActivePopup, PopupContext } from '../../../context/modal.ts';
import { getViewName } from '../../../util/cafe.ts';
import { pluralize, pluralizeWithCount } from '../../../util/string.ts';
import { nativeDayOfWeekNames } from '@msdining/common/dist/util/date-util';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { getLargestDate, getLocationDatesDisplay, getSequentialDateGroups } from '../../../util/date.ts';

interface IVisitPatternProps {
    cafeId: string;
    visits: Array<string>;
}

const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric'
});

interface IAllVisitsDisplayProps {
    pattern: IPatternData;
}

const AllVisitsDisplay: React.FC<IAllVisitsDisplayProps> = ({ pattern }) => {
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
        if (group.length === 1) {
            return getDateDisplay(group[0]);
        }

        group.sort((a, b) => a.getTime() - b.getTime());
        return `${getDateDisplay(group[0])} - ${getDateDisplay(group[group.length - 1])}`;
    });

    // const mostRecentVisits = visits.sort((a, b) => b.localeCompare(a));
    // const visitString = mostRecentVisits.map(dateString =>
    //     fromDateString(dateString).toLocaleDateString(undefined, {
    //         weekday: 'short',
    //         day: 'numeric',
    //         year: 'numeric',
    //         month: 'long'
    //     })).join(', ');

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

const getWeekdayGapString = (gap: number, weekdays: Array<number>) => {
    const weekdayNames = weekdays.map(weekday => nativeDayOfWeekNames[weekday]);

    if (gap === 1 && weekdays.length === 1) {
        return `Every ${weekdayNames[0]}`;
    }

    const weekdayDisplay = getLocationDatesDisplay(weekdays);
    return `Every ${pluralizeWithCount('week', gap)} on ${weekdayDisplay}`;
};

export const VisitPattern: React.FC<IVisitPatternProps> = ({ cafeId, visits }) => {
    const popupNotifier = useContext(PopupContext);
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(cafeId);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    if (!view) {
        return null;
    }

    const pattern = calculatePattern(visits);
    const weekdayGroups = new Map<number /*count*/, Array<number> /*weekdays*/>();
    for (const [weekday, gapData] of pattern.gapByWeekday) {
        const group = weekdayGroups.get(gapData.gap) ?? [];
        group.push(weekday);
        weekdayGroups.set(gapData.gap, group);
    }

    for (const group of weekdayGroups.values()) {
        group.sort((a, b) => a - b);
    }

    return (
        <div className="flex flex-col shrink-padding default-container bg-raised-2">
            <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="default-button default-container"
                onClick={() => closeActivePopup(popupNotifier)}>
                {
                    getViewName({ view, showGroupName: true })
                }
            </Link>
            {
                pattern.isEveryWeekday && (
                    <span>
                        Every day
                    </span>
                )
            }
            {
                !pattern.isEveryWeekday && weekdayGroups.size > 0 && (
                    <div className="flex">
                        <span className="material-symbols-outlined">
                            event_repeat
                        </span>
                        <div className="flex flex-col">
                            {
                                Array.from(weekdayGroups).map(([gap, weekdays]) => (
                                    <div className="flex">
                                        <span>
                                            {getWeekdayGapString(gap, weekdays)}
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )
            }
            {
                !pattern.isEveryWeekday && pattern.nextExpectedVisit && (
                    <div className="flex">
                        <span className="material-symbols-outlined">
                            upcoming
                        </span>
                        <span>
                            Next expected visit: {
                                pattern.nextExpectedVisit.toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                    month: 'long'
                                })
                            }
                        </span>
                    </div>
                )
            }
            <AllVisitsDisplay pattern={pattern}/>
        </div>
    );
};