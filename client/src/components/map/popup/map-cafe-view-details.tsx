import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { CafeView } from '../../../models/cafe.ts';
import { useSelectedDate } from '../../../store/zustand/selected-date.ts';
import { useCafeOverviewQuery } from '../../../store/queries/cafe.ts';
import { getAllSingleCafesInView } from '../../../util/view.js';
import { OverviewMemberDetails } from './overview/overview-member-details.js';
import { RetryButton } from '../../button/retry-button.js';

interface IMapCafeViewDetails {
    view: CafeView;
    showAllStations?: boolean;
}

export const MapCafeViewDetails: React.FC<IMapCafeViewDetails> = ({ view, showAllStations = false }) => {
    const { viewsById } = useContext(ApplicationContext);
    const selectedDate = useSelectedDate();

    const { data: overviewData, isError, refetch } = useCafeOverviewQuery(view.value.id, selectedDate);

    const cafesInView = useMemo(
        () => getAllSingleCafesInView(view, viewsById),
        [view, viewsById]
    );

    if (isError) {
        return (
            <div>
                <span>
                    Error loading overview data. Please try again.
                </span>
                <RetryButton onClick={() => refetch()}/>
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
                        shutDownState={overviewData?.shutdownState[cafe.id]}
                    />
                ))
            }
        </div>
    );
};