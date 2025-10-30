import { SearchEntityType } from '@msdining/common/models/search';
import { classNames } from '../../../../util/react.js';
import React from 'react';
import { entityDisplayDataByType } from '../../../../constants/search.js';

interface IGroupTypeIconProps {
    type: SearchEntityType;
}

export const GroupTypeIcon: React.FC<IGroupTypeIconProps> = ({ type }) => {
    const displayData = entityDisplayDataByType[type];
    return (
        <span className={classNames(displayData.className, 'default-container flex flex-center')}>
            <span className='material-symbols-outlined'>
                {displayData.iconName}
            </span>
        </span>
    );
}