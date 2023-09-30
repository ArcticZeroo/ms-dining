import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getViewUrl } from '../../util/link.ts';
import './search.css';
import { ApplicationContext } from '../../context/app.ts';
import { SettingsContext } from '../../context/settings.ts';
import { getParentView } from '../../util/view';
import { ISearchResult } from '../../models/search.ts';
import { sortCafeIds } from '../../util/sorting.ts';

interface ISearchResultProps {
    result: ISearchResult;
}

export const SearchResult: React.FC<ISearchResultProps> = ({ result: { name, cafeIds, imageUrl } }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [{ showImages, useGroups }] = useContext(SettingsContext);
    const [cafeIdsInOrder, setCafeIdsInOrder] = useState<Array<string>>([]);

    useEffect(() => {
        setCafeIdsInOrder(sortCafeIds(cafeIds));
    }, [cafeIds]);

    return (
        <div className="card horizontal search-result">
            <div className="search-result-info">
                <div className="title">{name}</div>
                <div className="body search-result-hits">
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
    );
};