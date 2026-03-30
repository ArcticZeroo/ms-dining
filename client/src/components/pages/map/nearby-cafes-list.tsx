import React from 'react';
import { Link } from 'react-router-dom';
import { INearestCafe } from '../../../hooks/nearby-cafes.ts';
import { getViewName } from '../../../util/cafe.ts';

interface INearbyCafesListProps {
    nearestCafes: INearestCafe[];
}

const formatDistance = (distanceMiles: number): string => {
    if (distanceMiles < 0.03) {
        return 'In building';
    }
    return `${distanceMiles.toFixed(2)} mi`;
};

export const NearbyCafesList: React.FC<INearbyCafesListProps> = ({ nearestCafes }) => {
    return (
        <div className="flex-col">
            <div className="nearby-cafes-header">Nearby Cafes</div>
            {nearestCafes.length === 0 && (
                <span className="subtitle">No nearby cafes found</span>
            )}
            <div className="flex-col">
                {nearestCafes.map(({ view, distanceMiles }) => (
                    <div key={view.value.id} className="flex flex-between align-center">
                        <Link
                            className="default-button default-container"
                            to={`/map/overview/${view.value.id}`}
                            type="button"
                        >
                            {getViewName({ view, showGroupName: true, includeEmoji: true })}
                        </Link>
                        <span>
                            {formatDistance(distanceMiles)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
