import { Bar } from 'react-chartjs-2';
import React from 'react';
import 'chart.js/auto';
import { IPricePercentBucket } from '@msdining/common/models/price-history';

interface IPriceIncreaseChartProps {
    distribution: IPricePercentBucket[];
}

const PriceIncreaseChart: React.FC<IPriceIncreaseChartProps> = ({ distribution }) => (
    <Bar
        data={{
            labels:   distribution.map(bucket => bucket.label),
            datasets: [{
                label: 'Items',
                data:  distribution.map(bucket => bucket.count),
            }],
        }}
        options={{
            scales: {
                x: {
                    title: {
                        display: true,
                        text:    'Price increase'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text:    'Number of items'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text:    'Distribution of price increases'
                },
                legend: {
                    display: false
                }
            }
        }}
    />
);

export default PriceIncreaseChart;
