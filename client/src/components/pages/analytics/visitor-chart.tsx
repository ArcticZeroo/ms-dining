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
                    label: 'Unique Hourly Visitors',
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
                        type: 'time'
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