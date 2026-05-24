import React from 'react';
import { HourglassLoadingSpinner } from '../../../../icon/hourglass-loading-spinner.tsx';

export const CompletingFooter: React.FC = () => (
    <div className="order-cafe-footer">
        <div className="flex align-center flex-justify-center">
            <HourglassLoadingSpinner/>
            <span>Finishing your order...</span>
        </div>
    </div>
);
