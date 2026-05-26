import React, { useMemo } from 'react';
import { useSelectedDate } from '../../../store/zustand/selected-date.ts';
import { CafeView } from '../../../models/cafe.ts';
import { useCafeMenuOverviewSummaryQuery } from '../../../store/queries/cafe.ts';
import { getViewEmoji, getViewMemberCount } from '../../../util/view.ts';
import { pluralize } from '../../../util/string.ts';
import { ICafeShutdownState } from '@msdining/common/models/cafe';

interface ICafeMarkerTooltipContentProps {
    view: CafeView;
}

const getIsFullyClosed = (view: CafeView, shutdownStateByCafeId: Record<string /*cafeId*/, ICafeShutdownState> = {}) => {
    const shutdownCafeCount = Object.keys(shutdownStateByCafeId).length;
    return shutdownCafeCount > 0 && getViewMemberCount(view) === shutdownCafeCount;
}

const getShutdownMessage = (shutdownStateByCafeId: Record<string /*cafeId*/, ICafeShutdownState>) => {
    const shutdownEntries = Object.values(shutdownStateByCafeId);

    if (shutdownEntries.length === 0) {
        return null;
    }

    let fullCloseCount = 0;
    let onlineOrderingShutdownCount = 0;
    for (const entry of shutdownEntries) {
        if (entry.type === 'full') {
            fullCloseCount++;
        } else if (entry.type === 'online_ordering_only') {
            onlineOrderingShutdownCount++;
        }
    }

    const messages = [];
    if (fullCloseCount > 0) {
        messages.push(`${fullCloseCount} closed`);
    }

    if (onlineOrderingShutdownCount > 0) {
        messages.push(`${onlineOrderingShutdownCount} without online ordering`);
    }

    return `⚠️ ${messages.join(', ')}`;
}

export const CafeMarkerTooltipContent: React.FC<ICafeMarkerTooltipContentProps> = ({ view }) => {
    const selectedDate = useSelectedDate();

    const { data: summary, isPending, isError } = useCafeMenuOverviewSummaryQuery(view.value.id, selectedDate);

    const isFullyClosedToday = useMemo(() => getIsFullyClosed(view, summary?.shutdownState), [summary?.shutdownState, view]);

    const highlights: Array<[string /*key*/, string /*value*/]> = [];
    if (!isFullyClosedToday && summary) {
        const shutdownMessage = getShutdownMessage(summary.shutdownState);
        if (shutdownMessage) {
            highlights.push(['shutdownMessage', shutdownMessage]);
        }

        // Always show station highlights, even when some members are shut down
        if (summary.traveling > 0) {
            highlights.push(['traveling', `🛫 ${summary.traveling} traveling ${pluralize('station', summary.traveling)}`]);
        }
        if (summary.newStations > 0) {
            highlights.push(['newStations', `✨ ${summary.newStations} new ${pluralize('station', summary.newStations)}`]);
        }
        if (summary.newItems > 0) {
            highlights.push(['newItems', `✨ ${summary.newItems} ${pluralize('station', summary.newItems)} with new items`]);
        }
        if (summary.rotating > 0) {
            highlights.push(['rotating', `🔄 ${summary.rotating} rotating ${pluralize('station', summary.rotating)}`]);
        }

        if (summary.total === 0) {
            highlights.push(['empty', 'No menu available today']);
        }
    }

    return (
        <div className="cafe-marker-tooltip">
            <strong>{getViewEmoji(view)} {view.value.name}</strong>
            {
                isFullyClosedToday && (
                    <div className="tooltip-details">
                        Closed today
                    </div>
                )
            }
            {
                !isFullyClosedToday && summary && (
                    <div className="tooltip-details">
                        {summary.total > 0 && (
                            <span>{summary.total} {pluralize('station', summary.total)} today</span>
                        )}
                        {highlights.map(([key, text]) => (
                            <span key={key}>{text}</span>
                        ))}
                    </div>
                )
            }
            {isError && <span className="subtitle">Unable to load overview.</span>}
            {isPending && <span className="subtitle">Loading...</span>}
            <span className="tooltip-hint">Click for details · Right-click to favorite</span>
        </div>
    );
};
