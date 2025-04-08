import React from 'react';
import { range } from '../../util/range.ts';
import { Measurement } from '../../util/measurement.ts';
import { pluralize } from '../../util/string.ts';

const MAX_BAR_WIDTH = Measurement.fromRem(15);
const MIN_BAR_WIDTH = Measurement.fromRem(0.25);

interface IReviewStatsProps {
    totalCount: number;
    overallRating: number;
    counts: Record<number, number>;
}

export const ReviewStats: React.FC<IReviewStatsProps> = ({ overallRating, totalCount, counts }) => {
    return (
        <>
            <div className="flex flex-center">
                {(overallRating / 2).toFixed(2)} ⭐
                ({totalCount} {pluralize('review', totalCount)})
            </div>
            <div className="default-container bg-raised-4">
                {
                    Array.from(range(1, 10, { inclusive: true, step: 2 })).map(i => {
                        const count = (counts[i] ?? 0) + (counts[i + 1] ?? 0);

                        const percentOfTotal = count / totalCount;
                        const width = Math.max(MIN_BAR_WIDTH.inPixels, MAX_BAR_WIDTH.inPixels * percentOfTotal);

                        return (
                            <div className="flex" key={i}>
                                <span>
                                    {((i - 1) / 2) + 1}⭐
                                </span>
                                <div className="review-count-bar" style={{ width: `${width}px`, }}/>
                                <span className="review-count">
                                    {count}
                                </span>
                            </div>
                        );
                    })
                }
            </div>
        </>
    );
}
