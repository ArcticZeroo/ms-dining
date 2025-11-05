import React, { useCallback, useMemo, useState } from 'react';
import { CollapsibleControllerContext, ICollapsibleController } from '../../context/collapsible.js';

interface ICollapsibleContainerProps {
    children: React.ReactNode;
    isExpandedByDefault?: boolean;
}

export const CollapsibleContainer: React.FC<ICollapsibleContainerProps> = ({
    children,
    isExpandedByDefault = false
}) => {
    const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);

    const toggleExpanded = useCallback(() => {
        setIsExpanded(previousIsExpanded => !previousIsExpanded);
    }, []);

    const contextValue = useMemo(
        () => ({
            isExpanded,
            toggleExpanded
        } satisfies ICollapsibleController),
        [isExpanded, toggleExpanded]);

    return (
        <CollapsibleControllerContext.Provider value={contextValue}>
            {children}
        </CollapsibleControllerContext.Provider>
    );
};