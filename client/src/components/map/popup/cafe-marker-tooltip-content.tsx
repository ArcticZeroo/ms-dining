import { toDateString } from '@msdining/common/util/date-util';
import React, { useCallback, useMemo } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/client/dining.ts';
import { SelectedDateContext } from '../../../context/time.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../../models/cafe.ts';
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

    console.log(shutdownEntries, fullCloseCount, onlineOrderingOnlyCount);

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
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const dateString = useMemo(
        () => toDateString(selectedDate),
        [selectedDate]
    );

    const fetchOverviewSummary = useCallback(
        () => DiningClient.retrieveMenuOverviewSummary(view.value.id, dateString),
        [view, dateString]
    );

    const { value: summary, stage } = useImmediatePromiseState(fetchOverviewSummary);

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
            {
                stage === PromiseStage.error && (
                    <span className="subtitle">Unable to load overview.</span>
                )
            }
            {
                stage === PromiseStage.running && (
                    <span className="subtitle">Loading...</span>
                )
            }
            <span className="tooltip-hint">Click for details · Right-click to favorite</span>
        </div>
    );
};
