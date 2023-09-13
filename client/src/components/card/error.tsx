import React from 'react';

export const ErrorCard: React.FC = ({ children }) => {
    return (
        <div className="error-card">
            {children}
        </div>
    );
};