import React from 'react';
import { range } from '../../util/range.ts';
import { formatReviewScore } from '../../util/reviews.js';
import { ReviewRatingBar } from './review-rating-bar.tsx';

interface IReviewStatsProps {
    totalCount: number;
    overallRating: number;
    counts: Record<number, number>;
}

export const ReviewStats: React.FC<IReviewStatsProps> = ({ overallRating, totalCount, counts }) => {
    return (
        <>
            <div className="flex flex-center">
                {formatReviewScore(overallRating, totalCount)}
            </div>
            <div className="default-container bg-raised-4">
                {
                    Array.from(range(1, 10, { inclusive: true, step: 2 })).map(i => (
                        <ReviewRatingBar
                            key={i}
                            star={((i - 1) / 2) + 1}
                            count={(counts[i] ?? 0) + (counts[i + 1] ?? 0)}
                            totalCount={totalCount}
                        />
                    ))
                }
            </div>
        </>
    );
}
