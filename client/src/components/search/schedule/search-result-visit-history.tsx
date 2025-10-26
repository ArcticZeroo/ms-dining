import React, { useCallback, useContext, useMemo } from 'react';
import { SearchEntityType } from '@msdining/common/models/search';
import { IRunnablePromiseState, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/client/dining.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { IEntityVisitData } from '@msdining/common/models/pattern';
import { VisitPattern } from './visit-pattern.tsx';
import { ApplicationContext } from '../../../context/app.ts';
import { CafeView } from '../../../models/cafe.ts';
import { compareViewNames } from '../../../util/sorting.ts';
import './visit.css';

const useVisitHistoryRequest = (entityType: SearchEntityType, name: string) => {
    const makeRequestCallback = useCallback(
        () => DiningClient.retrieveVisitHistory(entityType, name),
        [entityType, name]
    );

    return useImmediatePromiseState(makeRequestCallback);
};

const useVisitHistoryDataResponse = (response: IRunnablePromiseState<Array<IEntityVisitData>>): Array<[CafeView, Array<string /*dateString*/>]> => {
    const { viewsById } = useContext(ApplicationContext);

    return useMemo(
        () => {
            if (response.value == null) {
                return [];
            }

            response.value.sort((a, b) => {
                return b.dateString.localeCompare(a.dateString);
            });

            const visitsByView: Map<CafeView, Array<string /*dateString*/>> = new Map();

            for (const { dateString, cafeId } of response.value) {
                const view = viewsById.get(cafeId);
                if (view == null) {
                    console.error(`Could not find view for cafeId ${cafeId}`);
                    continue;
                }

                const visitsForView = visitsByView.get(view) ?? [];
                visitsForView.push(dateString);
                visitsByView.set(view, visitsForView);
            }
            
            const visitEntries = Array.from(visitsByView.entries());
            visitEntries.sort(([a], [b]) => {
                return compareViewNames(a.value.name, b.value.name);
            });

            return visitEntries;
        },
        [response.value, viewsById]
    );
};

interface ISearchResultVisitHistoryPopupBodyProps {
    entityType: SearchEntityType;
    name: string;
}

export const SearchResultVisitHistory: React.FC<ISearchResultVisitHistoryPopupBodyProps> = ({
    entityType,
    name,
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

    if (data.length === 0) {
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
                    data.map(([view, visitDates]) => (
                        <VisitPattern key={view.value.id} view={view} visits={visitDates}/>
                    ))
                }
            </div>
            <div className="subtitle">
                Pattern estimates are based on the last month. No guarantees for future visits.
            </div>
        </div>
    );
};