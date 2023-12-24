import { ExpandIcon } from '../../../icon/expand.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';
import React, { useMemo, useState } from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { classNames } from '../../../../util/react.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { SelectedDateContext } from '../../../../context/time.ts';

interface IHomeFavoriteResultListProps {
    results: IQuerySearchResult[];
}

export const HomeFavoriteResultList: React.FC<IHomeFavoriteResultListProps> = ({ results }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const onToggleExpansion = () => {
        setIsCollapsed(!isCollapsed);
    }

    const resultsView = useMemo(() => (
        results.map(result => (
            <HomeFavoriteResult
                key={result.name}
                result={result}
                date={selectedDate}
            />
        ))
    ), [results, selectedDate]);

    return (
        <div className="collapsible-content flex-col" id="home-favorites">
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                <div className="flex-row">
                    Favorites Across Campus on {selectedDate.toLocaleDateString()}
                </div>
                <ExpandIcon isExpanded={!isCollapsed}/>
            </div>
            <div
                className={classNames('collapse-body', isCollapsed && 'collapsed')}
                id="home-favorites-results"
            >
                {resultsView}
            </div>
        </div>
    );
};