import React, { useContext } from 'react';
import { CollapsibleControllerContext } from '../../context/collapsible.js';

interface ICollapsibleHeaderProps {
    children: React.ReactNode;
}

export const CollapsibleHeader: React.FC<ICollapsibleHeaderProps> = ({ children }) => {
    const controller = useContext(CollapsibleControllerContext);
    
    return (
        <div className="flex flex-between">
            {children}
            {
                controller && (
                    <button
                        className="material-symbols-outlined default-button default-container icon-container"
                        onClick={controller.toggleExpanded}
                        aria-label={controller.isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {controller.isExpanded ? 'expand_less' : 'expand_more'}
                    </button>
                )
            }
        </div>
    );
}