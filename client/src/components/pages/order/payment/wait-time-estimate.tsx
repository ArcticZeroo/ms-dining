import React from 'react';
import { useWaitTimeQuery } from '../../../../store/queries/ordering.ts';

interface IWaitTimeEstimateProps {
    cafeId: string;
}

const formatWaitTime = (minutes: number) => {
    return `${Math.round(minutes)} min`;
};

const formatWaitTimeRange = (minTime: number, maxTime: number) =>
    `${formatWaitTime(minTime)} – ${formatWaitTime(maxTime)}`;

interface IWaitTimeEstimateBannerProps {
    waitTime: { minTime: number; maxTime: number } | undefined;
}

export const WaitTimeEstimateBanner: React.FC<IWaitTimeEstimateBannerProps> = ({ waitTime }) => {
    if (!waitTime) {
        return null;
    }

    return (
        <div className="text-center subtitle">
            Estimated wait: {formatWaitTimeRange(waitTime.minTime, waitTime.maxTime)}
        </div>
    );
};

export const WaitTimeEstimate: React.FC<IWaitTimeEstimateProps> = ({ cafeId }) => {
    const { data } = useWaitTimeQuery(cafeId);

    return <WaitTimeEstimateBanner waitTime={data}/>;
};
