import React, { useContext } from 'react';
import { CollapsibleControllerContext } from '../../context/collapsible.js';

interface ICollapsibleBodyProps {
    children: React.ReactNode;
}

export const CollapsibleBody: React.FC<ICollapsibleBodyProps> = ({ children }) => {
    const controller = useContext(CollapsibleControllerContext);

    if (!controller || !controller.isExpanded) {
        return null;
    }

    return children;
}