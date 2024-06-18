import { Bar } from 'react-chartjs-2';
import React, { useCallback, useMemo } from 'react';
import 'chart.js/auto';
import 'chartjs-adapter-luxon';
import { IHourlyVisitCount } from "@msdining/common/dist/models/analytics";

interface ILineDataPoint {
    x: string;
    y: number;
}

interface IVisitorChartProps {
    isTotalCount: boolean;
    visits: IHourlyVisitCount[];
}

const VisitorChart: React.FC<IVisitorChartProps> = ({ visits, isTotalCount }) => {
    const [data, allDates] = useMemo(
        () => {
            const data: Array<ILineDataPoint> = [];
            const allDates = new Set<string>();

            for (const visit of visits) {
                allDates.add(visit.date);
                data.push({
                    x: visit.date,
                    y: isTotalCount
                        ? visit.totalCount
                        : visit.count
                });
            }

            return [data, allDates];
        },
        [visits, isTotalCount]
    );

    const shouldShowTick = useCallback(
        (value: unknown) => typeof value === 'string' && allDates.has(value) ? value : undefined,
        [allDates]
    );

    const label = isTotalCount
        ? 'Total Hourly Requests'
        : 'Unique Hourly Visitors';

    const title = isTotalCount
        ? 'Total Requests by Hour'
        : 'Unique Visitors by Hour';

    return (
        <Bar
            data={{
                datasets: [{
                    label,
                    data
                }],
            }}
            options={{
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        type: 'time',
                        ticks: {
                            callback: shouldShowTick
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Visitors'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: title,
                    },
                    legend: {
                        display: false
                    }
                }
            }}
        />
    );
};

export default VisitorChart;