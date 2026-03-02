import React, { useContext } from 'react';
import { IQuerySearchResult } from '../../../models/search.ts';
import { entityDisplayDataByType } from '../../../constants/search.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { classNames } from '../../../util/react.ts';
import { formatSearchResultPrice } from '../../../util/search.js';

const MAX_VISIBLE_CAFES = 4;

export interface IMapSearchResultItemProps {
    result: IQuerySearchResult;
    isSelected: boolean;
    onMouseEnter(): void;
    onMouseLeave(): void;
    onClick(): void;
}

export const MapSearchResultItem: React.FC<IMapSearchResultItemProps> = ({ result, isSelected, onMouseEnter, onMouseLeave, onClick }) => {
    const { viewsById } = useContext(ApplicationContext);
    const displayData = entityDisplayDataByType[result.entityType];
    const cafeIds = Array.from(result.locationDatesByCafeId.keys());
    const price = formatSearchResultPrice(result);

    const allCafeNames = cafeIds.map(id => viewsById.get(id)?.value.name ?? id);
    const visibleNames = allCafeNames.slice(0, MAX_VISIBLE_CAFES);
    const remainingCount = allCafeNames.length - visibleNames.length;

    return (
        <div
            className={classNames('map-search-result flex-col', displayData.className, isSelected && 'selected')}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            title={`Click to open details for ${result.name}`}
        >
            <div className="result-header flex">
                <span className={classNames('material-symbols-outlined result-icon centered-content', displayData.className)}>
                    {displayData.iconName}
                </span>
                <span className="result-name">{result.name}</span>
                {price && <span className="result-price">{price}</span>}
            </div>
            {result.description && (
                <span className="result-description subtitle">{result.description}</span>
            )}
            <span className="result-cafes subtitle">
                {visibleNames.join(', ')}
                {remainingCount > 0 && ` +${remainingCount} more`}
            </span>
        </div>
    );
};
