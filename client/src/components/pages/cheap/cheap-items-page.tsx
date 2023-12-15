import React, { useMemo, useState } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { SearchResult } from '../../search/search-result.tsx';
import { SearchTypes } from '@msdining/common';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { CheapItemsSortType } from '../../../models/search.ts';
import { SortButton } from './sort-button.tsx';

const useCheapItems = (sortType: CheapItemsSortType) => {
    const { stage, value, error } = useImmediatePromiseState(DiningClient.retrieveCheapItems);

    const sortedResults = useMemo(() => {
        if (!value) {
            return [];
        }

        switch (sortType) {
            case CheapItemsSortType.priceAsc:
                return value.sort((a, b) => a.price - b.price);
            case CheapItemsSortType.priceDesc:
                return value.sort((a, b) => b.price - a.price);
            case CheapItemsSortType.relevance:
                // TODO
                return value;
        }
    }, [value, sortType]);

    return {
        stage,
        error,
        results: sortedResults,
    };
}

export const CheapItemsPage: React.FC = () => {
    const [sortType, setSortType] = useState(CheapItemsSortType.priceAsc);
    const { stage, results, error } = useCheapItems(sortType);

    if (stage === PromiseStage.error) {
        return (
            <div className="error-card">
                Could not load cheap items.
                <br/>
                {String(error)}
            </div>
        );
    }

    const items = results ?? [];

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="search-result-count">
                        Total Results: {items.length}
                    </div>
                </div>
                <SearchWaiting stage={stage}/>
            </div>
            <div className="search-filter-selector">
                <SortButton
                    name="Price Ascending"
                    currentSort={sortType}
                    type={CheapItemsSortType.priceAsc}
                    onClick={() => setSortType(CheapItemsSortType.priceAsc)}
                />
                <SortButton
                    name="Price Descending"
                    currentSort={sortType}
                    type={CheapItemsSortType.priceDesc}
                    onClick={() => setSortType(CheapItemsSortType.priceDesc)}
                />
                {/*<SortButton*/}
                {/*    name="Relevance"*/}
                {/*    currentSort={sortType}*/}
                {/*    type={CheapItemsSortType.relevance}*/}
                {/*    onClick={() => setSortType(CheapItemsSortType.relevance)}*/}
                {/*/>*/}
            </div>
            <div className="search-results">
                {
                    items.map(item => (
                        <SearchResult
                            key={item.name}
                            isVisible={true}
                            name={item.name}
                            description={item.description}
                            locationDatesByCafeId={item.locationDatesByCafeId}
                            imageUrl={item.imageUrl}
                            entityType={SearchTypes.SearchEntityType.menuItem}
                            price={item.price}
                        />
                    ))
                }
            </div>
        </div>
    );
}