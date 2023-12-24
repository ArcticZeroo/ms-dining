import { ExpandIcon } from '../../../icon/expand.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';
import React, { useState } from 'react';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { classNames } from '../../../../util/react.ts';

interface IHomeFavoriteResultListProps {
    results: IQuerySearchResult[];
}

export const HomeFavoriteResultList: React.FC<IHomeFavoriteResultListProps> = ({ results }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const onToggleExpansion = () => {
        setIsCollapsed(!isCollapsed);
    }

    return (
        <div className="collapsible-content flex-col" id="home-favorites">
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                <span>
                    Favorites Across Campus
                </span>
                <ExpandIcon isExpanded={!isCollapsed}/>
            </div>
            <div className={classNames('flex-col collapse-body', isCollapsed && 'collapsed')}>
                {
                    results.map(result => (
                        <HomeFavoriteResult
                            key={result.name}
                            result={result}
                        />
                    ))
                }
            </div>
        </div>
    );
};