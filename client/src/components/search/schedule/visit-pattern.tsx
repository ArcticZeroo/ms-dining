import React, { useContext } from 'react';
import { calculatePattern, IPatternData } from '@msdining/common/util/pattern-util';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';
import { getViewName } from '../../../util/cafe.ts';
import { pluralizeWithCount } from '../../../util/string.ts';
import { nativeDayOfWeekNames } from '@msdining/common/util/date-util';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { getLocationDatesDisplay } from '../../../util/date.ts';
import { CafeView } from '../../../models/cafe.ts';
import { AllVisitsDisplay } from './all-visits-display.tsx';
import { VisitRepeat } from './visit-repeat.tsx';
import { useCafeIdsOnPage } from '../../../hooks/cafes-on-page.ts';
import { usePopupCloserAlways } from '../../../hooks/popup.ts';

interface IVisitPatternProps {
    view: CafeView;
    visits: Array<string>;
}

const getWeekdayGapString = (gap: number, weekdays: Array<number>) => {
    const weekdayNames = weekdays.map(weekday => nativeDayOfWeekNames[weekday]);

    if (gap === 1 && weekdays.length === 1) {
        return `Every ${weekdayNames[0]}`;
    }

    const weekdayDisplay = getLocationDatesDisplay(weekdays);
    return `Every ${pluralizeWithCount('week', gap)} on ${weekdayDisplay}`;
};

const getWeekdayGroups = (pattern: IPatternData) => {
    const weekdayGroups = new Map<number /*count*/, Array<number> /*weekdays*/>();
    for (const [weekday, gapData] of pattern.gapByWeekday) {
        const group = weekdayGroups.get(gapData.gap) ?? [];
        group.push(weekday);
        weekdayGroups.set(gapData.gap, group);
    }

    for (const group of weekdayGroups.values()) {
        group.sort((a, b) => a - b);
    }

    return weekdayGroups;
}

export const VisitPattern: React.FC<IVisitPatternProps> = ({ view, visits }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const cafeIdsOnPage = useCafeIdsOnPage();
    const closePopup = usePopupCloserAlways();

    const pattern = calculatePattern(visits);
    const weekdayGroups = getWeekdayGroups(pattern);

    const url = getViewMenuUrl({ view, viewsById, shouldUseGroups, cafeIdsOnPage });

    return (
        <div className="flex flex-col shrink-padding default-container bg-raised-2">
            <Link to={url} className="default-button default-container"
                onClick={closePopup}>
                { getViewName({ view, showGroupName: true }) }
            </Link>
            {
                pattern.isEveryWeekday && (
                    <VisitRepeat>
                        Every day
                    </VisitRepeat>
                )
            }
            {
                !pattern.isEveryWeekday && weekdayGroups.size > 0 && (
                    <VisitRepeat>
                        {
                            Array.from(weekdayGroups).map(([gap, weekdays]) => (
                                <div className="flex" key={gap}>
                                    <span>
                                        {getWeekdayGapString(gap, weekdays)}
                                    </span>
                                </div>
                            ))
                        }
                    </VisitRepeat>
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