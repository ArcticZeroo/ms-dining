import React from 'react';

export interface ICollapsibleController {
    isExpanded: boolean;
    toggleExpanded: () => void;
}

export const CollapsibleControllerContext = React.createContext<ICollapsibleController | undefined>(undefined);