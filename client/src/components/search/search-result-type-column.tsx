import { SearchTypes } from '@msdining/common';
import React from 'react';
import { entityDisplayDataByType } from '../../constants/search.js';
import { CafeView } from '../../models/cafe.ts';
import { classNames } from '../../util/react.ts';
import { SearchResultVisitHistoryButton } from './schedule/search-result-visit-history-button.tsx';
import { SearchResultFavoriteButton } from './search-result-favorite-button.tsx';
import { SearchResultSearchButton } from './search-result-search-button.tsx';

interface ISearchResultTypeColumnProps {
    entityType: SearchTypes.SearchEntityType;
    entityView?: CafeView;
    isCompact: boolean;
    name: string;
    showFavoriteButton: boolean;
}

export const SearchResultTypeColumn: React.FC<ISearchResultTypeColumnProps> = ({
    entityType,
    entityView,
    isCompact,
    name,
    showFavoriteButton,
}) => {
    const entityDisplayData = entityDisplayDataByType[entityType];

    return (
        <div className={classNames('flex-col search-result-type', entityDisplayData.className)}>
            {
                isCompact && (
                    <SearchResultFavoriteButton
                        entityType={entityType}
                        entityView={entityView}
                        name={name}
                        showFavoriteButton={showFavoriteButton}
                    />
                )
            }
            {
                isCompact && <SearchResultVisitHistoryButton entityType={entityType} name={name}/>
            }
            {
                isCompact && <SearchResultSearchButton name={name}/>
            }
            <span className="material-symbols-outlined">
                {entityDisplayData.iconName}
            </span>
        </div>
    );
};
