import React from 'react';
import { useSelectedDate } from '../../../store/zustand/selected-date.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
import { useCafeMenuOverviewSummaryQuery } from '../../../store/queries/cafe.ts';
import { getViewEmoji } from '../../../util/view.ts';
import { pluralize } from '../../../util/string.ts';
import { ICafeShutdownState } from '@msdining/common/models/cafe';

interface ICafeMarkerTooltipContentProps {
    view: CafeView;
}

const getShutdownMessage = (view: CafeView, shutdownStateByCafeId: Record<string, ICafeShutdownState>) => {
    const memberCount = view.type === CafeViewType.group ? view.value.members.length : 1;
    const shutdownEntries = Object.values(shutdownStateByCafeId);

    if (shutdownEntries.length === 0) {
        return null;
    }

    if (shutdownEntries.length === memberCount) {
        return '⚠️ Closed';
    }

    let fullCloseCount = 0;
    let onlineOrderingOnlyCount = 0;
    for (const entry of shutdownEntries) {
        if (entry.type === 'full') {
            fullCloseCount++;
        } else if (entry.type === 'online_ordering_only') {
            onlineOrderingOnlyCount++;
        }
    }

    const messages = [];
    if (fullCloseCount > 0) {
        messages.push(`${fullCloseCount} closed`);
    }

    if (onlineOrderingOnlyCount > 0) {
        messages.push(`${onlineOrderingOnlyCount} without online ordering`);
    }

    return `⚠️ ${messages.join(', ')}`;
}

export const CafeMarkerTooltipContent: React.FC<ICafeMarkerTooltipContentProps> = ({ view }) => {
    const selectedDate = useSelectedDate();

    const { data: summary, isPending, isError } = useCafeMenuOverviewSummaryQuery(view.value.id, selectedDate);

    const highlights: string[] = [];
    if (summary) {
        const shutdownMessage = getShutdownMessage(view, summary.shutdownState);
        if (shutdownMessage) {
            highlights.push(shutdownMessage);
        }

        // Always show station highlights, even when some members are shut down
        if (summary.traveling > 0) {
            highlights.push(`🛫 ${summary.traveling} traveling ${pluralize('station', summary.traveling)}`);
        }
        if (summary.newStations > 0) {
            highlights.push(`✨ ${summary.newStations} new ${pluralize('station', summary.newStations)}`);
        }
        if (summary.newItems > 0) {
            highlights.push(`✨ ${summary.newItems} ${pluralize('station', summary.newItems)} with new items`);
        }
        if (summary.rotating > 0) {
            highlights.push(`🔄 ${summary.rotating} rotating ${pluralize('station', summary.rotating)}`);
        }
    }

    return (
        <div className="cafe-marker-tooltip">
            <strong>{getViewEmoji(view)} {view.value.name}</strong>
            {summary && (
                <div className="tooltip-details">
                    {summary.total > 0 && (
                        <span>{summary.total} {pluralize('station', summary.total)} today</span>
                    )}
                    {highlights.map((text, index) => (
                        <span key={index}>{text}</span>
                    ))}
                </div>
            )}
            {isError && <span className="subtitle">Unable to load overview.</span>}
            {isPending && <span className="subtitle">Loading...</span>}
            <span className="tooltip-hint">Click for details · Right-click to favorite</span>
        </div>
    );
};
