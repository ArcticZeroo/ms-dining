import React from 'react';
import { InfoTip } from './info-tip.tsx';

interface ISignalProps {
    label: string;
    tip?: string;
    children: React.ReactNode;
}

export const Signal: React.FC<ISignalProps> = ({ label, tip, children }) => (
    <div className="explain-signal flex-col">
        <span className="explain-signal-label">
            {label}{tip && <> <InfoTip text={tip}/></>}
        </span>
        <span className="explain-signal-value">{children}</span>
    </div>
);
