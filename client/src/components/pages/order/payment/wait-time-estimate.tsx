import React from 'react';

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
