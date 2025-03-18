import React, { useContext } from 'react';
import { calculatePattern } from '@msdining/common/dist/util/pattern-util';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';
import { closeActivePopup, PopupContext } from '../../../context/modal.ts';
import { getViewName } from '../../../util/cafe.ts';
import { pluralize } from '../../../util/string.ts';
import { fromDateString, nativeDayOfWeekNames } from '@msdining/common/dist/util/date-util';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';

interface IVisitPatternProps {
    cafeId: string;
    visits: Array<string>;
}

export const VisitPattern: React.FC<IVisitPatternProps> = ({ cafeId, visits }) => {
    const popupNotifier = useContext(PopupContext);
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(cafeId);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    
    if (!view) {
        return null;
    }
    
    const pattern = calculatePattern(visits);
    const groups = new Map<number /*count*/, Array<number> /*weekdays*/>();
    for (const [weekday, gapData] of pattern.gapByWeekday) {
        const group = groups.get(gapData.gap) ?? [];
        group.push(weekday);
        groups.set(gapData.gap, group);
    }

    return (
        <div className="card dark-blue flex">
            <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="default-button default-container" onClick={() => closeActivePopup(popupNotifier)}>
                {
                    getViewName({ view, showGroupName: true })
                }
            </Link>
            {
                pattern.isEveryWeekday && 'Every day'
            }
            {
                !pattern.isEveryWeekday && Array.from(groups).map(([gap, weekdays]) =>
                    <div>
                        Every {gap} {pluralize('week', gap)} on {weekdays.map(weekday => nativeDayOfWeekNames[weekday]).join(', ')}
                    </div>
                )
            }
            {
                pattern.nextExpectedVisit && (
                    <div>
                        Next expected visit: {
                            pattern.nextExpectedVisit.toLocaleDateString(undefined, {
                                weekday: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                month: 'long'
                            })
                        }
                    </div>
                )
            }
            {
                visits.map(dateString =>
                    fromDateString(dateString).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        month: 'long'
                    })).join(', ')
            }
        </div>
    );
}