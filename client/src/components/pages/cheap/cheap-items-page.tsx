import React, { useEffect } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';

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
        <div className="cheap-items-page">
            {
                items.map(item => (
                    <div key={item.name}>
                        <div>
                            {item.name}
                        </div>
                        <div>
                            {item.price}
                        </div>
                        <div>
                            {item.description}
                        </div>
                    </div>
                ))
            }
        </div>
    );
}