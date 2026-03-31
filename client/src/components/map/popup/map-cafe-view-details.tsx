import React, { useCallback, useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { CafeView } from '../../../models/cafe.ts';
import { toDateString } from '@msdining/common/util/date-util';
import { SelectedDateContext } from '../../../context/time.js';
import { DiningClient } from '../../../api/client/dining.js';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { getAllSingleCafesInView } from '../../../util/view.js';
import { OverviewMemberDetails } from './overview/overview-member-details.js';
import { RetryButton } from '../../button/retry-button.js';

const useOverviewData = (viewId: string) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const selectedDateString = useMemo(
        () => toDateString(selectedDate),
        [selectedDate]
    );

    const retrieveOverview = useCallback(
        () => DiningClient.retrieveOverview(viewId, selectedDateString),
        [viewId, selectedDateString]
    );

    return useImmediatePromiseState(retrieveOverview);
};

interface IMapCafeViewDetails {
    view: CafeView;
    showAllStations?: boolean;
}

export const MapCafeViewDetails: React.FC<IMapCafeViewDetails> = ({ view, showAllStations = false }) => {
    const { viewsById } = useContext(ApplicationContext);

    const { value: overviewData, error, run } = useOverviewData(view.value.id);

    const cafesInView = useMemo(
        () => getAllSingleCafesInView(view, viewsById),
        [view, viewsById]
    );

    if (error) {
        return (
            <div>
                <span>
                    Error loading overview data. Please try again.
                </span>
                <RetryButton onClick={run}/>
            </div>
        );
    }

    return (
        <div className="group-member-list flex flex-wrap flex-center">
            {
                cafesInView.map(cafe => (
                    <OverviewMemberDetails
                        key={cafe.id}
                        cafe={cafe}
                        showAllStations={showAllStations}
                        overviewStations={overviewData?.stations[cafe.id]}
                    />
                ))
            }
        </div>
    );
};