import React, { useState } from 'react';
import { classNames } from '../../../util/react.ts';
import { ExpandIcon } from '../../icon/expand.tsx';

interface IHomeCollapseProps {
	title: string;
	children?: React.ReactNode;
}

export const HomeCollapse: React.FC<IHomeCollapseProps> = ({ title, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
	
    const onToggleExpansion = () => setIsCollapsed(!isCollapsed);
	
    return (
        <div className={classNames('collapsible-content flex-col', isCollapsed && 'collapsed')}>
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                <div className="flex-row">
                    {title}
                </div>
                <ExpandIcon isExpanded={!isCollapsed}/>
            </div>
            <div className="collapse-body">
                {children}
            </div>
        </div>
    );
};