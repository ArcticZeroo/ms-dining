import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { toDateString } from '@msdining/common/util/date-util';
import React, { useCallback, useMemo } from 'react';
import { DiningClient } from '../../../../api/client/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../../../button/retry-button.js';
import { CafePopupOverviewWithData } from '../../../cafes/cafe-popup-overview-with-data.js';

const useOverviewData = (cafe: ICafe) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const selectedDateString = useMemo(
        () => toDateString(selectedDate),
        [selectedDate]
    );

    const retrieveOverviews = useCallback(
        () => DiningClient.retrieveCafeMenuOverview(cafe, selectedDateString),
        [cafe, selectedDateString]
    );

    return useImmediatePromiseState(retrieveOverviews);
};

interface ICafeMarkerOverviewProps {
    cafe: ICafe;
    showMessageForNoStations?: boolean;
}


export const CafePopupOverview: React.FC<ICafeMarkerOverviewProps> = ({ cafe }) => {
    const { value: overviewStations, error, run } = useOverviewData(cafe);

    if (error) {
        return (
            <div>
                <span>
                    Unable to load overview.
                </span>
                <RetryButton onClick={run}/>
            </div>
        );
    }

    if (overviewStations) {
        return (
            <CafePopupOverviewWithData
                cafe={cafe}
                overviewStations={overviewStations}
            />
        );
    }

    return (
        <div>
            <HourglassLoadingSpinner/>
        </div>
    );
};