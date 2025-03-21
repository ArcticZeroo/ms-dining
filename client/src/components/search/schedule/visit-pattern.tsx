import React, { useContext } from 'react';
import { calculatePattern } from '@msdining/common/dist/util/pattern-util';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';
import { closeActivePopup, PopupContext } from '../../../context/modal.ts';
import { getViewName } from '../../../util/cafe.ts';
import { pluralizeWithCount } from '../../../util/string.ts';
import { nativeDayOfWeekNames } from '@msdining/common/dist/util/date-util';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { getLocationDatesDisplay } from '../../../util/date.ts';
import { CafeView } from '../../../models/cafe.ts';
import { AllVisitsDisplay } from './all-visits-display.tsx';
import { VisitRepeat } from './visit-repeat.tsx';

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

export const VisitPattern: React.FC<IVisitPatternProps> = ({ view, visits }) => {
    const popupNotifier = useContext(PopupContext);
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

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