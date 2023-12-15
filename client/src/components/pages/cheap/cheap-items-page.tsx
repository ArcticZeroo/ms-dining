import React, { useEffect } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { SearchResult } from '../../search/search-result.tsx';
import { SearchTypes } from '@msdining/common';

export const CheapItemsPage: React.FC = () => {
    const { stage: searchStage, value: results, error } = useImmediatePromiseState(DiningClient.retrieveCheapItems);

    useEffect(() => {
        if (searchStage === PromiseStage.error) {
            console.error(error);
        }
    }, [searchStage, error]);

    if (searchStage === PromiseStage.running) {
        return (
            <div>
                <div className="loading-spinner"/>
                Loading cheap items..
            </div>
        );
    }

    if (searchStage === PromiseStage.error) {
        return (
            <div className="error-card">
                Could not load cheap items.
            </div>
        );
    }

    const items = results ?? [];

    return (
        <div className="search-page">
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