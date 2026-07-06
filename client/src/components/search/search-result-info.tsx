import { SearchTypes } from '@msdining/common';
import { SearchMatchReason } from '@msdining/common/models/search';
import React from 'react';
import { CafeView } from '../../models/cafe.ts';
import { SearchResultCafeLinks } from './search-result-cafe-links.tsx';
import { SearchResultExtraFields } from './search-result-extra-fields.tsx';
import { SearchResultImageSection } from './search-result-image-section.tsx';
import { SearchResultLocationsSection } from './search-result-locations-section.tsx';
import { SearchResultSearchTags } from './search-result-search-tags.tsx';
import { SearchResultTitleSection } from './search-result-title-section.tsx';
import { ISearchResultField } from './search-result-types.ts';

interface ISearchResultInfoProps {
    cafeId?: string;
    description?: string;
    entityKey?: string;
    entityType: SearchTypes.SearchEntityType;
    entityView?: CafeView;
    extraFields: ISearchResultField[];
    imageUrl?: string;
    isCompact: boolean;
    isSkeleton: boolean;
    locationDatesByCafeId: Map<string, Date[]>;
    matchReasons: Set<SearchMatchReason>;
    matchedModifiers: Map<string, Set<string>>;
    name: string;
    onlyShowLocationsOnDate?: Date;
    overallRating?: number;
    priceByCafeId: Map<string, number>;
    searchTags?: Set<string>;
    showFavoriteButton: boolean;
    showOnlyCafeNames: boolean;
    showSearchButtonInsteadOfLocations: boolean;
    stationByCafeId: Map<string, string>;
    tags?: Set<string>;
    totalReviewCount?: number;
}

export const SearchResultInfo: React.FC<ISearchResultInfoProps> = ({
    cafeId,
    description,
    entityKey,
    entityType,
    entityView,
    extraFields,
    imageUrl,
    isCompact,
    isSkeleton,
    locationDatesByCafeId,
    matchReasons,
    matchedModifiers,
    name,
    onlyShowLocationsOnDate,
    overallRating,
    priceByCafeId,
    searchTags,
    showFavoriteButton,
    showOnlyCafeNames,
    showSearchButtonInsteadOfLocations,
    stationByCafeId,
    tags,
    totalReviewCount,
}) => {
    return (
        <div className="search-result-info">
            <div className="search-result-info-header">
                <SearchResultTitleSection
                    description={description}
                    entityKey={entityKey}
                    entityType={entityType}
                    entityView={entityView}
                    isCompact={isCompact}
                    matchReasons={matchReasons}
                    name={name}
                    overallRating={overallRating}
                    showFavoriteButton={showFavoriteButton}
                    tags={tags}
                    totalReviewCount={totalReviewCount}
                />
                <SearchResultSearchTags searchTags={searchTags}/>
                <SearchResultExtraFields
                    extraFields={extraFields}
                    isCompact={isCompact}
                    matchedModifiers={matchedModifiers}
                />
                {
                    isCompact && (
                        <SearchResultImageSection
                            imageUrl={imageUrl}
                            isSkeleton={isSkeleton}
                            name={name}
                        />
                    )
                }
                <SearchResultCafeLinks cafeId={cafeId} entityView={entityView} name={name}/>
                <SearchResultLocationsSection
                    entityType={entityType}
                    isCompact={isCompact}
                    isSkeleton={isSkeleton}
                    locationDatesByCafeId={locationDatesByCafeId}
                    name={name}
                    onlyShowLocationsOnDate={onlyShowLocationsOnDate}
                    priceByCafeId={priceByCafeId}
                    showOnlyCafeNames={showOnlyCafeNames}
                    showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
                    stationByCafeId={stationByCafeId}
                />
            </div>
            {
                !isCompact && (
                    <SearchResultImageSection
                        imageUrl={imageUrl}
                        isSkeleton={isSkeleton}
                        name={name}
                    />
                )
            }
        </div>
    );
};
