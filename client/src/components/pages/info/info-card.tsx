import React from 'react';

interface IInfoCardProps {
    title: string;
    children: React.ReactNode;
}

export const InfoCard: React.FC<IInfoCardProps> = ({ title, children }) => (
    <div className="card">
        <div className="title">
            {title}
        </div>
        {children}
    </div>
);
