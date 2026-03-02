import { toDateString } from '@msdining/common/util/date-util';
import React, { useCallback, useMemo } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/client/dining.ts';
import { SelectedDateContext } from '../../../context/time.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { CafeView } from '../../../models/cafe.ts';
import { getViewEmoji } from '../../../util/view.ts';
import { pluralize } from '../../../util/string.ts';

interface ICafeMarkerTooltipContentProps {
    view: CafeView;
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
                    <span>{summary.total} {pluralize('station', summary.total)} today</span>
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
