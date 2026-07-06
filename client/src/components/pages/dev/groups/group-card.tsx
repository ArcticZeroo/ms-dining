import React from 'react';
import { CollapsibleContainer } from '../../../collapsible/collapsible-container.js';

interface IGroupCardProps {
    children: React.ReactNode;
}

export const GroupCard: React.FC<IGroupCardProps> = ({ children }) => {
    return (
        <div className="default-container bg-raised-2 flex-col">
            <CollapsibleContainer>
                {children}
            </CollapsibleContainer>
        </div>
    );
};
