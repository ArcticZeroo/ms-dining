import React, { Suspense } from 'react';
import { IHourlyVisitCount } from '../../../models/analytics.ts';

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

export const AnalyticsPage = () => {
    const fakeVisits: IHourlyVisitCount[] = [
        {
            date: '2023-09-15T00:00',
            count: 10
        },
        {
            date: '2023-09-15T01:00',
            count: 8
        },
        {
            date: '2023-09-15T02:00',
            count: 11
        },
        {
            date: '2023-09-15T05:00',
            count: 5
        },
    ];

    return (
        <div className="card">
            <Suspense fallback={<div>Loading chart...</div>}>
                <VisitorChart visits={fakeVisits}/>
            </Suspense>
        </div>
    );
};