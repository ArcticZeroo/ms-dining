import React from 'react';

interface IFullHeightCenteredContainerProps {
    children: React.ReactNode;
}

export const FullHeightCenteredContainer: React.FC<IFullHeightCenteredContainerProps> = ({ children}) => {
    return (
        <div className="flex flex-center" style={{ height: '100%' }}>
            {children}
        </div>  
    );
}