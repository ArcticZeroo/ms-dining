import React, { useCallback, useMemo } from 'react';
import { SearchTypes } from '@msdining/common';
import { IQuerySearchResult } from '../../../models/search.ts';
import { useMapSearchContext, useMapHighlightContext } from '../../../context/map.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { pluralize } from '../../../util/string.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { EntityTypeSelector } from '../search/entity-type-selector.js';
import { MapSearchResultItem } from './map-search-result-item.tsx';
import starIcon from '../../../assets/icons/filled/star-white.svg';
import { classNames } from '../../../util/react.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { RetryButton } from '../../button/retry-button.js';

interface IMapSearchResultsProps {
    results?: IQuerySearchResult[];
    isFilteredToHomeCafes: boolean;
    onFilterToHomeCafes(): void;
}

export const MapSearchResults: React.FC<IMapSearchResultsProps> = ({ results, isFilteredToHomeCafes, onFilterToHomeCafes }) => {
    const { query, allResults: allResults, entityFilter, setEntityFilter, stage, retry } = useMapSearchContext();
    const { selectedSearchResult, setSelectedSearchResult, setHighlightedCafeIds } = useMapHighlightContext();
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const hasHomeCafes = homepageViewIds.size > 0;

    const clearHighlight = useCallback(
        () => setHighlightedCafeIds(new Set()),
        [setHighlightedCafeIds]
    );

    const tabCounts = useMemo(() => {
        const counts = new Map<SearchTypes.SearchEntityType, number>();
        if (allResults) {
            for (const result of allResults) {
                counts.set(result.entityType, (counts.get(result.entityType) ?? 0) + 1);
            }
        }
        return counts;
    }, [allResults]);

    if (stage === PromiseStage.error) {
        return (
            <div className="panel-content map-search-status flex-col">
                <span>
                    Error searching for "{query}"
                </span>
                <RetryButton onClick={retry}/>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="panel-content map-search-status flex-col">
                <HourglassLoadingSpinner/>
                <span className="subtitle">Searching for "{query}"...</span>
            </div>
        );
    }

    if (allResults && allResults.length === 0) {
        return (
            <div className="panel-content map-search-status flex-col">
                <span className="subtitle">No results for "{query}"</span>
            </div>
        );
    }

    return (
        <div className="panel-content flex-col">
            <div className="map-search-filters flex-col">
                <EntityTypeSelector
                    selectedType={entityFilter}
                    onSelectedTypeChanged={setEntityFilter}
                    tabCounts={tabCounts}
                />
                {hasHomeCafes && (
                    <button
                        onClick={onFilterToHomeCafes}
                        className={classNames('map-home-cafes-button default-container default-button flex flex-center', isFilteredToHomeCafes && 'active')}
                        title={isFilteredToHomeCafes ? 'Already filtered to your favorite cafes' : 'Filter to your favorite cafes'}
                        disabled={isFilteredToHomeCafes}
                    >
                        <img src={starIcon} alt="" className="icon-sized"/>
                        My Cafes
                    </button>
                )}
            </div>
            <span className="subtitle map-search-result-count">
                {results.length} {pluralize('result', results.length)} for "{query}"
            </span>
            <div className="map-search-results-list flex-col">
                {results.map((result, index) => (
                    <MapSearchResultItem
                        key={`${result.entityType}-${result.name}-${index}`}
                        result={result}
                        isSelected={selectedSearchResult === result}
                        onMouseEnter={() => setHighlightedCafeIds(new Set(result.locationDatesByCafeId.keys()))}
                        onMouseLeave={clearHighlight}
                        onClick={() => {
                            setSelectedSearchResult(selectedSearchResult === result ? null : result);
                            setHighlightedCafeIds(new Set(result.locationDatesByCafeId.keys()));
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
