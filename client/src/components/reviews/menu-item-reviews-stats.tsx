import React from 'react';
import { range } from '../../util/range.ts';
import { Measurement } from '../../util/measurement.ts';

const MAX_BAR_WIDTH = Measurement.fromRem(15);
const MIN_BAR_WIDTH = Measurement.fromRem(0.25);

interface IMenuItemReviewsStatsProps {
    totalCount: number;
    counts: Record<number, number>;
}

export const MenuItemReviewsStats: React.FC<IMenuItemReviewsStatsProps> = ({ totalCount, counts }) => {
    return (
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
    );
}
