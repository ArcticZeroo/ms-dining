import React, { useMemo } from 'react';
import { ReviewsView } from './reviews-view.tsx';
import { useReviewSummary } from '../../store/queries/reviews.ts';

import './reviews.css';

interface IMenuItemReviewsViewProps {
    menuItemId: string;
    menuItemName: string;
    cafeId: string;
    stationId?: string;
    stationName?: string;
}

export const MenuItemReviewsView: React.FC<IMenuItemReviewsViewProps> = ({ menuItemId, menuItemName, cafeId, stationId, stationName }) => {
    const lookup = useMemo(() => ({ menuItemId, menuItemName }), [menuItemId, menuItemName]);
    const stationLookup = useMemo(
        () => stationId ? { stationId, stationName: stationName ?? '' } : undefined,
        [stationId, stationName]
    );

    const { status, data, refetch } = useReviewSummary(lookup);

    return (
        <div className="default-container bg-raised-3 flex-col">
            <div className="title">
                Reviews
            </div>
            <ReviewsView
                status={status}
                response={data}
                onRetry={() => refetch()}
                cafeId={cafeId}
                lookup={lookup}
                stationLookup={stationLookup}
            />
        </div>
    )
}