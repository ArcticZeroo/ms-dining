import React, { useContext, useMemo } from 'react';
import { IQuerySearchResult } from '../../../models/search.ts';
import { entityDisplayDataByType } from '../../../constants/search.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { isTagHighlighted, knownTags } from '../../../constants/tags.tsx';
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
    const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);
    const displayData = entityDisplayDataByType[result.entityType];
    const cafeIds = Array.from(result.locationDatesByCafeId.keys());
    const price = formatSearchResultPrice(result);

    const highlightTag = useMemo(() => {
        if (!result.tags || highlightTagNames.size === 0) {
            return undefined;
        }

        for (const tagName of result.tags) {
            if (isTagHighlighted(tagName, highlightTagNames)) {
                return knownTags[tagName];
            }
        }
    }, [result.tags, highlightTagNames]);

    const allCafeNames = cafeIds.map(id => viewsById.get(id)?.value.name ?? id);
    const visibleNames = allCafeNames.slice(0, MAX_VISIBLE_CAFES);
    const remainingCount = allCafeNames.length - visibleNames.length;

    return (
        <div
            className={classNames('map-search-result flex-col', displayData.className, isSelected && 'selected', highlightTag && 'tag-highlighted')}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            title={`Click to open details for ${result.name}`}
            style={highlightTag ? { '--highlight-tag-color': highlightTag.color } as React.CSSProperties : undefined}
        >
            <div className="result-header flex">
                <span className={classNames('material-symbols-outlined result-icon centered-content', displayData.className)}>
                    {displayData.iconName}
                </span>
                <span className="result-name">{result.name}</span>
                {highlightTag && (
                    <span className="result-tag" title={highlightTag.name}>
                        {highlightTag.icon}
                    </span>
                )}
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
