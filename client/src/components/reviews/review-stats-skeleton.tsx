import React from 'react';

// Placeholder bar widths so the histogram reads as a silhouette rather than data.
const HISTOGRAM_ROWS: { star: number; width: string }[] = [
    { star: 1, width: '1rem' },
    { star: 2, width: '2.5rem' },
    { star: 3, width: '4rem' },
    { star: 4, width: '6rem' },
    { star: 5, width: '9rem' },
];

/** Disabled placeholder mirroring ReviewStats (score line + rating histogram). */
export const ReviewStatsSkeleton: React.FC = () => (
    <>
        <div className="flex flex-center">
            <span>⭐ (reviews)</span>
        </div>
        <div className="default-container bg-raised-4 flex-col">
            {
                HISTOGRAM_ROWS.map(({ star, width }) => (
                    <div className="flex" key={star}>
                        <span>{star}⭐</span>
                        <div className="review-count-bar" style={{ width }}/>
                    </div>
                ))
            }
        </div>
    </>
);
