import { SearchTypes } from '@msdining/common';
import { SearchEntityType, SearchMatchReason } from '@msdining/common/models/search';
import React from 'react';
import { CafeView } from '../../models/cafe.ts';
import { SearchResultVisitHistoryButton } from './schedule/search-result-visit-history-button.tsx';
import { SearchResultFavoriteButton } from './search-result-favorite-button.tsx';
import { SearchResultOrderCount } from './search-result-order-count.tsx';
import { SearchResultReviewScore } from './search-result-review-score.tsx';
import { SearchResultTags } from './search-result-tags.tsx';

interface ISearchResultTitleSectionProps {
    description?: string;
    entityKey?: string;
    entityType: SearchTypes.SearchEntityType;
    entityView?: CafeView;
    isCompact: boolean;
    matchReasons: Set<SearchMatchReason>;
    name: string;
    overallRating?: number;
    showFavoriteButton: boolean;
    tags?: Set<string>;
    totalReviewCount?: number;
}

export const SearchResultTitleSection: React.FC<ISearchResultTitleSectionProps> = ({
    description,
    entityKey,
    entityType,
    entityView,
    isCompact,
    matchReasons,
    name,
    overallRating,
    showFavoriteButton,
    tags,
    totalReviewCount,
}) => {
    return (
        <div className="flex">
            {
                !isCompact && (
                    <SearchResultFavoriteButton
                        entityType={entityType}
                        entityView={entityView}
                        name={name}
                        showFavoriteButton={showFavoriteButton}
                    />
                )
            }
            {
                !isCompact && entityType !== SearchEntityType.cafe && (
                    <SearchResultVisitHistoryButton entityType={entityType} name={name}/>
                )
            }
            <div className="title">
                <span>
                    {name}
                </span>
                {
                    !isCompact && description &&
                    <div className="search-result-description">{description}</div>
                }
                <SearchResultReviewScore overallRating={overallRating} totalReviewCount={totalReviewCount}/>
                <SearchResultOrderCount entityKey={entityKey}/>
                <SearchResultTags
                    isCompact={isCompact}
                    matchReasons={matchReasons}
                    tags={tags}
                />
            </div>
        </div>
    );
};
