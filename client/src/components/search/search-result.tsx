import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { getDiningHallMenuUrl } from '../../util/link.ts';
import './search.css';
import { ApplicationContext } from '../../context/app.ts';
import { SettingsContext } from '../../context/settings.ts';

interface ISearchResultProps {
    name: string;
    imageUrl?: string;
    diningHallIds: string[];
}

export const SearchResult: React.FC<ISearchResultProps> = ({ name, imageUrl, diningHallIds }) => {
    const { diningHallsById } = useContext(ApplicationContext);
    const [{ showImages }] = useContext(SettingsContext);

    return (
        <div className="card horizontal search-result">
            <div className="search-result-info">
                <div className="title">{name}</div>
                <div className="body search-result-hits">
                    {
                        diningHallIds.map(id => {
                            const diningHall = diningHallsById.get(id);

                            if (!diningHall) {
                                return false;
                            }

                            return (
                                <Link to={getDiningHallMenuUrl(diningHall)} className="search-result-chip" key={diningHall.id}>
                                    {diningHall.name}
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