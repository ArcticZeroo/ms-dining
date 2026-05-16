import React from 'react';
import { IReviewSummary } from '@msdining/common/models/review';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';
import { RetryButton } from '../button/retry-button.tsx';
import { ReviewsViewWithData } from './reviews-view-with-data.tsx';
import { IReviewLookup, IReviewLookupForStation } from '../../models/reviews.js';

interface IReviewsViewProps {
    status: 'pending' | 'success' | 'error';
    response: IReviewSummary | undefined;
    onRetry: () => void;
    cafeId: string;
    lookup: IReviewLookup;
    stationLookup?: IReviewLookupForStation;
}

export const ReviewsView: React.FC<IReviewsViewProps> = ({ status, response, onRetry, cafeId, lookup, stationLookup }) => {
    if (status === 'pending') {
        return (
            <div className="flex flex-center">
                <span>
                    Loading reviews...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    if (status === 'error' || response == null) {
        return (
            <div className="flex flex-center">
                <span>Could not load reviews!</span>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    return (
        <ReviewsViewWithData
            response={response}
            cafeId={cafeId}
            lookup={lookup}
            stationLookup={stationLookup}
        />
    );
};
