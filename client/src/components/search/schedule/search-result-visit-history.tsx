import React, { useCallback, useContext, useMemo } from 'react';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { IRunnablePromiseState, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { IEntityVisitData } from '@msdining/common/dist/models/pattern';
import { fromDateString } from '@msdining/common/dist/util/date-util';
import { ApplicationContext } from '../../../context/app.ts';
import { getViewName } from '../../../util/cafe.ts';
import { CafeView } from '../../../models/cafe.ts';

const useVisitHistoryRequest = (entityType: SearchEntityType, name: string) => {
    const makeRequestCallback = useCallback(
        () => DiningClient.retrieveVisitHistory(entityType, name),
        [entityType, name]
    );

    return useImmediatePromiseState(makeRequestCallback);
};

const useVisitHistoryDataResponse = (response: IRunnablePromiseState<Array<IEntityVisitData>>): Map<CafeView, Array<string /*dateString*/>> => {
    const { viewsById } = useContext(ApplicationContext);

    return useMemo(
        () => {
            if (response.value == null) {
                return new Map();
            }

            response.value.sort((a, b) => {
                return b.dateString.localeCompare(a.dateString);
            });

            const visitsByView: Map<CafeView, Array<string /*dateString*/>> = new Map();

            for (const { dateString, cafeId } of response.value) {
                const view = viewsById.get(cafeId);
                if (!view) {
                    continue;
                }

                const visitsForView = visitsByView.get(view) ?? [];
                visitsForView.push(dateString);
                visitsByView.set(view, visitsForView);
            }

            return visitsByView;
        },
        [response.value, viewsById]
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
        <div className="card">
            <table>
                <thead>
                    <tr>
                        <th>
                        Cafe
                        </th>
                        <th>
                        Visit Dates
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        Array.from(data).map(([view, dateStrings]) => {
                            return (
                                <tr>
                                    <td>
                                        {
                                            getViewName({ view, showGroupName: true })
                                        }
                                    </td>
                                    <td>
                                        {
                                            dateStrings.map(dateString =>
                                                fromDateString(dateString).toLocaleDateString(undefined, {
                                                    weekday: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    month: 'long'
                                                })).join(', ')
                                        }
                                    </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>
        </div>
    );
};