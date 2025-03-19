import React, { useCallback, useMemo } from 'react';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { IRunnablePromiseState, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { IEntityVisitData } from '@msdining/common/dist/models/pattern';
import { VisitPattern } from './visit-pattern.tsx';

import './visit.css';

const useVisitHistoryRequest = (entityType: SearchEntityType, name: string) => {
    const makeRequestCallback = useCallback(
        () => DiningClient.retrieveVisitHistory(entityType, name),
        [entityType, name]
    );

    return useImmediatePromiseState(makeRequestCallback);
};

const useVisitHistoryDataResponse = (response: IRunnablePromiseState<Array<IEntityVisitData>>): Map<string /*cafeId*/, Array<string /*dateString*/>> => {
    return useMemo(
        () => {
            if (response.value == null) {
                return new Map();
            }

            response.value.sort((a, b) => {
                return b.dateString.localeCompare(a.dateString);
            });

            const visitsByCafeId: Map<string /*cafeId*/, Array<string /*dateString*/>> = new Map();

            for (const { dateString, cafeId } of response.value) {
                const visitsForView = visitsByCafeId.get(cafeId) ?? [];
                visitsForView.push(dateString);
                visitsByCafeId.set(cafeId, visitsForView);
            }

            return visitsByCafeId;
        },
        [response.value]
    );
};

interface ISearchResultVisitHistoryPopupBodyProps {
    entityType: SearchEntityType;
    name: string;
    cafeIdsOnPage: Set<string> | undefined;
}

export const SearchResultVisitHistory: React.FC<ISearchResultVisitHistoryPopupBodyProps> = ({
    entityType,
    name,
    // cafeIdsOnPage
}) => {
    const response = useVisitHistoryRequest(entityType, name);
    const data = useVisitHistoryDataResponse(response);

    if (response.error != null) {
        return (
            <div className="card error">
                <span>
                    Could not load visit history ☹
                </span>️
                <RetryButton onClick={response.run}/>
            </div>
        );
    }

    if (response.value == null) {
        return (
            <div className="card">
                <span>
                    Loading...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    if (data.size === 0) {
        return (
            <div className="card">
                <span>
                    No visits recorded in the past month.
                </span>
            </div>
        );
    }

    return (
        <div className="card flex">
            <div className="flex flex-wrap flex-center">
                {
                    Array.from(data.entries()).map(([cafeId, visitDates]) => (
                        <VisitPattern key={cafeId} cafeId={cafeId} visits={visitDates}/>
                    ))
                }
            </div>
            <div className="subtitle">
                Pattern estimates are based on the last month. No guarantees for future visits.
            </div>
        </div>
    );
};