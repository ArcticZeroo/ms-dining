import React from 'react';
import { IConnectorStop } from '@msdining/common/constants/connector-stops';
import { classNames } from '../../../util/react.js';

interface IStopListItemProps {
    stop: IConnectorStop;
    isSelected: boolean;
    onClick(): void;
    onMouseEnter(): void;
    onMouseLeave(): void;
}

export const StopListItem: React.FC<IStopListItemProps> = ({ stop, isSelected, onClick, onMouseEnter, onMouseLeave }) => (
    <div
        className={classNames('map-search-result flex-col', isSelected && 'selected')}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        title={stop.description || stop.name}
    >
        <div className="result-header flex">
            <span className="result-name">{stop.name}</span>
        </div>
        {stop.route && (
            <span className="result-description subtitle">{stop.route}</span>
        )}
        {stop.hasParking && (
            <span className="result-cafes subtitle">🅿️ Parking available</span>
        )}
    </div>
);
