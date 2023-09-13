import React from 'react';

export interface IErrorCardProps {
    children: React.ReactNode;
}

export const ErrorCard: React.FC<IErrorCardProps> = ({ children }) => {
    return (
        <div className="error-card">
            {children}
        </div>
    );
};