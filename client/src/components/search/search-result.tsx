import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../context/app.ts';
import { ISearchResult, SearchEntityType } from '../../models/search.ts';
import { getViewUrl } from '../../util/link.ts';
import { classNames } from '../../util/react';
import { sortCafeIds } from '../../util/sorting.ts';
import { getParentView } from '../../util/view';
import './search.css';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

interface IEntityDisplayData {
    className: string;
    iconName: string;
}

const entityDisplayDataByType: Record<SearchEntityType, IEntityDisplayData> = {
    [SearchEntityType.menuItem]: {
        className: 'entity-menu-item',
        iconName: 'lunch_dining'
    },
    [SearchEntityType.station]: {
        className: 'entity-station',
        iconName: 'restaurant'
    }
};

interface ISearchResultProps {
    result: ISearchResult;
}

export const SearchResult: React.FC<ISearchResultProps> = ({ result: { name, cafeIds, imageUrl, entityType } }) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const useGroups = useValueNotifier(ApplicationSettings.useGroups);
    const [cafeIdsInOrder, setCafeIdsInOrder] = useState<Array<string>>([]);

    useEffect(() => {
        setCafeIdsInOrder(sortCafeIds(cafeIds));
    }, [cafeIds]);

    const entityDisplayData = entityDisplayDataByType[entityType];

    return (
        <div className="search-result">
            <div className={classNames('search-result-type', entityDisplayData.className)}>
                <span className="material-symbols-outlined">
                    {entityDisplayData.iconName}
                </span>
            </div>
            <div className="search-result-info">
                <div className="search-result-info-header">
                    <div className="search-result-name">{name}</div>
                    <div className="search-result-hits">
                        {
                            cafeIdsInOrder.map(id => {
                                const view = viewsById.get(id);

                                if (!view) {
                                    return false;
                                }

                                const parentView = getParentView(viewsById, useGroups, view);

                                return (
                                    <Link to={getViewUrl(parentView)} className="search-result-chip" key={view.value.id}>
                                        {view.value.name}
                                    </Link>
                                );
                            })
                        }
                    </div>
                </div>
                {
                    (imageUrl && showImages) && (
                                                 <img src={imageUrl} alt={name} className="search-result-image"/>
                                             )
                }
            </div>
        </div>
    );
};