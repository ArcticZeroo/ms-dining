import React from 'react';
import { ReviewsView } from './reviews-view.tsx';
import { useReviewSummary } from '../../store/queries/reviews.ts';
import { IReviewLookup, IReviewLookupForStation } from '../../models/reviews.js';

interface IMenuItemReviewsTabProps {
    cafeId: string;
    lookup: IReviewLookup;
    stationLookup?: IReviewLookupForStation;
}

/**
 * Reviews-tab content. Owns the review-summary query so review loading only
 * re-renders this tab, not the whole popup / the active Overview tab.
 */
export const MenuItemReviewsTab: React.FC<IMenuItemReviewsTabProps> = ({ cafeId, lookup, stationLookup }) => {
    const { status, data, refetch } = useReviewSummary(lookup);

    return (
        <ReviewsView
            status={status}
            response={data}
            onRetry={() => refetch()}
            cafeId={cafeId}
            lookup={lookup}
            stationLookup={stationLookup}
        />
    );
};
