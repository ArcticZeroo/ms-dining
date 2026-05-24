import React from 'react';
import { HourglassLoadingSpinner } from '../../../../icon/hourglass-loading-spinner.tsx';

interface ILoadingFooterProps {
    message: string;
}

export const LoadingFooter: React.FC<ILoadingFooterProps> = ({ message }) => (
    <div className="flex align-center flex-justify-center">
        <HourglassLoadingSpinner/>
        <span>{message}</span>
    </div>
);
