import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { getViewUrl } from '../../util/link.ts';
import './search.css';
import { ApplicationContext } from '../../context/app.ts';
import { SettingsContext } from '../../context/settings.ts';
import { getParentView } from '../../util/view';

interface ISearchResultProps {
    name: string;
    imageUrl?: string;
    cafeIds: string[];
}

export const SearchResult: React.FC<ISearchResultProps> = ({ name, imageUrl, cafeIds }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [{ showImages, useGroups }] = useContext(SettingsContext);

    return (
        <div className="card horizontal search-result">
            <div className="search-result-info">
                <div className="title">{name}</div>
                <div className="body search-result-hits">
                    {
                        cafeIds.map(id => {
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