import React, { useState } from 'react';
import { classNames } from '../../util/react.ts';
import { ExpandIcon } from '../icon/expand.tsx';

interface ISettingsGroupProps {
    iconName: string;
    title: string;
    children: React.ReactNode;
}

export const SettingsGroup: React.FC<ISettingsGroupProps> = ({ iconName, title, children }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className={classNames('card settings-group collapsible-content', !isExpanded && 'collapsed')}>
            <div className="title collapse-toggle" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="material-symbols-outlined">
                    {iconName}
                </span>
                <span>
                    {title}
                </span>
                <ExpandIcon isExpanded={isExpanded}/>
            </div>
            <div className="body collapse-body">
                {children}
            </div>
        </div>
    );
}