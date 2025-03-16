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

const useVisitHistoryDataResponse = (response: IRunnablePromiseState<Array<IEntityVisitData>>): Array<[string, Array<CafeView>]> => {
    const { viewsById } = useContext(ApplicationContext);

    return useMemo(
        () => {
            if (response.value == null) {
                return [];
            }

            const viewsByDateString: Map<string, Array<CafeView>> = new Map();

            for (const { dateString, cafeId } of response.value) {
                const view = viewsById.get(cafeId);
                if (!view) {
                    continue;
                }

                const views = viewsByDateString.get(dateString) ?? [];
                views.push(view);
                viewsByDateString.set(dateString, views);
            }

            return Array.from(viewsByDateString.entries())
                .sort(([a], [b]) => {
                    return b.localeCompare(a);
                });
        },
        [response.value, viewsById]
    );
};

interface ISearchResultVisitHistoryPopupBodyProps {
    entityType: SearchEntityType;
    name: string;
}

export const SearchResultVisitHistoryPopupBody: React.FC<ISearchResultVisitHistoryPopupBodyProps> = ({ entityType, name }) => {
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
                    No previous visits.
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
                            Date
                        </th>
                        <th>
                            Cafe
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        data.map(([dateString, views]) => {
                            const viewNames = views.map(view => getViewName({ view, showGroupName: true }));
                            viewNames.sort((a, b) => {
                                if (typeof a === 'number') {
                                    if (typeof b === 'number') {
                                        return a - b;
                                    }

                                    return -1;
                                }

                                if (typeof b === 'number') {
                                    return 1;
                                }

                                return a.localeCompare(b);
                            })

                            return (
                                <tr>
                                    <td>
                                        {
                                            fromDateString(dateString).toLocaleDateString(undefined, {
                                                weekday: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                                month: 'long'
                                            })
                                        }
                                    </td>
                                    <td>
                                        {viewNames.join(', ')}
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