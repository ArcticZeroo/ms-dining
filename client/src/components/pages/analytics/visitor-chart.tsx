import { Bar } from 'react-chartjs-2';
import { IHourlyVisitCount } from '../../../models/analytics.ts';
import React, { useEffect, useState } from 'react';
import 'chart.js/auto';
import 'chartjs-adapter-luxon';

interface IVisitorChartProps {
    visits: IHourlyVisitCount[];
}

interface ILineDataPoint {
    x: string;
    y: number;
}

const VisitorChart: React.FC<IVisitorChartProps> = ({ visits }) => {
    const [data, setData] = useState<Array<ILineDataPoint>>();

    /*useEffect(() => {
        // Probably not needed, maybe should skip?
        const timeSortedVisits = [...visits].sort((a, b) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        const dataWithoutGaps = [];

        let currentTime = new Date(timeSortedVisits[0]?.date);
        for (const visit of timeSortedVisits) {
            const visitTime = new Date(visit.date);

            // It's OK if we have a delta of a little more than an hour, the server might have been slow to aggregate.
            while ((visitTime.getTime() - currentTime.getTime()) > oneHour.inMilliseconds) {
                dataWithoutGaps.push({
                    x: currentTime.toISOString(),
                    y: 0,
                });
                currentTime = addDurationToDate(currentTime, oneHour);
            }

            dataWithoutGaps.push({
                x: visit.date,
                y: visit.count
            });

            currentTime = addDurationToDate(currentTime, oneHour);
        }

        setData(dataWithoutGaps);
    }, [visits]);*/
    useEffect(() => {
        setData(visits.map(visit => ({
            x: visit.date,
            y: visit.count
        })));
    }, [visits]);

    return (
        <Bar
            data={{
                datasets: [{
                    data
                }],
            }}
            options={{
                scales: {
                    x: {
                        title: {
                            text: 'Time'
                        },
                        type: 'time'
                    },
                    y: {
                        title: {
                            text: 'Visitors'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Unique Visitors by Hour',
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