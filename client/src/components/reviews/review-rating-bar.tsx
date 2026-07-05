import React from 'react';
import { Measurement } from '../../util/measurement.ts';

const MAX_BAR_WIDTH = Measurement.fromRem(15);
const MIN_BAR_WIDTH = Measurement.fromRem(0.25);

interface IReviewRatingBarProps {
    star: number;
    count: number;
    totalCount: number;
}

export const ReviewRatingBar: React.FC<IReviewRatingBarProps> = ({ star, count, totalCount }) => {
    const percentOfTotal = count / totalCount;
    const width = Math.max(MIN_BAR_WIDTH.inPixels, MAX_BAR_WIDTH.inPixels * percentOfTotal);

    return (
        <div className="flex">
            <span>
                {star}⭐
            </span>
            <div className="review-count-bar" style={{ width: `${width}px` }}/>
            <span className="review-count">
                {count}
            </span>
        </div>
    );
};
