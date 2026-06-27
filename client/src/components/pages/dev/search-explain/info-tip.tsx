import React from 'react';

interface IInfoTipProps {
    text: string;
}

export const InfoTip: React.FC<IInfoTipProps> = ({ text }) => (
    <span className="explain-info" tabIndex={0} title={text} aria-label={text}>?</span>
);
