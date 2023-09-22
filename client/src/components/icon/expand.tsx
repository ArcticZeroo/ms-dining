import React from 'react';
import { classNames } from '../../util/react.ts';

interface IExpandIconProps {
    isExpanded: boolean;
}

export const ExpandIcon: React.FC<IExpandIconProps> = ({ isExpanded }) => {
    return (
        <span className={classNames('material-symbols-outlined', 'expand-icon', isExpanded ? 'expanded' : 'collapsed')}>
            expand_more
        </span>
    );
}